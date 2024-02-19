import {
	userJwt,
	signToken,
	hashPassword, 
} from '@fromafrica/edge-api'
import { Hono } from 'hono'
import * as postmark from "postmark"
import { customAlphabet } from 'nanoid'

type Bindings = {
	ENVIRONMENT: string;
	INVALIDTOKENS: KVNamespace;
	HMAC: string;
}

const app = new Hono<{ Bindings: Bindings }>()

async function fetchGQL(whichEnv: String, queryString: String) {
	try {
		const response = await fetch(whichEnv === 'dev' ? 'http://localhost:8080' : 'https://api.fromafri.ca', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				// Include additional headers as needed
				// like authorization headers
			},
			body: JSON.stringify({
				query: queryString
			}),
		})
  
		const data = await response.json();

		return data
	  
	} catch (error) {
	  throw error // Rethrow the error for the caller to handle
	}
  }
  

app.options('*', (c) => {
    c.header('Access-Control-Allow-Origin', c.env.ENVIRONMENT === 'dev' ? 'https://id.fromafrica.local.host' : 'https://id.fromafri.ca')
	c.header('Access-Control-Allow-Methods', 'POST, OPTIONS')
	c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Access-Control-Allow-Origin')
	c.header('Access-Control-Expose-Headers', 'Content-Length')
	c.header('Access-Control-Allow-Credentials', 'true')

    return c.body(null, 204)
})

app.get('*', async (c) => {
	c.redirect(c.env.ENVIRONMENT === 'dev' ? 'https://fromafrica.local.host' : 'https://fromafri.ca', 301)
})

app.post('/', async (c) => {

	c.header('Access-Control-Allow-Origin', c.env.ENVIRONMENT === 'dev' ? 'https://id.fromafrica.local.host' : 'https://id.fromafri.ca')
	c.header('Access-Control-Allow-Methods', 'POST, OPTIONS')
	c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Access-Control-Allow-Origin')
	c.header('Access-Control-Expose-Headers', 'Content-Length')
	c.header('Access-Control-Allow-Credentials', 'true')

	const reqBody = await c.req.json();

	if (!reqBody.username || !reqBody.email || !reqBody.password) {
		c.status(200)
		c.header('Content-Type', 'application/json')
		return c.body(JSON.stringify({ status: { 'code': 413, 'message': 'form error detected!'}, user: null }))
	}

	const username = reqBody.username;
	const email = reqBody.email;
	const password = reqBody.password;
	
	const passHash = await hashPassword(password as string);

	const nanoid = customAlphabet('123456789ABCDEFGHIJKLMNPQRSTVWXYZabcdefghijklmnprstvwxyz', 12)
	const id = nanoid()

	// TODO: SANITIZE INPUT
	let query = `mutation { 
					signUp (id: "${ id }", username: "${ username }", password: "${ password }", email: "${ email }") 
					{ 
						status { 
							code 
							message 
						}
						user {
							id
							username
							email
						}
					} 
				}`

	try {
		const gqlRes: any = await fetchGQL(c.env.ENVIRONMENT, query) // execute query

		const gqlStatus: any = gqlRes.data.signUp

		console.log(gqlStatus)

		if (gqlStatus.status.code !== 200) {
			c.status(200)
			c.header('Content-Type', 'application/json')
			return c.body(JSON.stringify({ status: { 'code': 412, 'message': 'system error detected!'}, user: null }))
		}

		if (gqlStatus.status.code === 200) {
			let jwt: userJwt = {
				'role': 'user',
				'userId': id,
				'username': username,
				'email': email,
			}
			
			// sign the JWT, user now logged in
			const tokenIssuer = c.env.ENVIRONMENT === 'dev' ? 'id.fromafrica.local.host' : 'id.fromafri.ca';
			const tokenAudience = c.env.ENVIRONMENT === 'dev' ? 'fromafrica.local.host' : 'fromafri.ca';
			const token = await signToken(jwt, c.env.HMAC, tokenIssuer, tokenAudience);
	 
			// TODO: store auth session with details
			c.status(200)
			const COOKIE_DOMAIN = c.env.ENVIRONMENT === 'dev' ? '.fromafrica.local.host' : '.fromafri.ca';
	 
			c.header('Content-Type', 'application/json')
			c.header('Set-Cookie', "FawlUser="+ token +"; Domain="+ COOKIE_DOMAIN +"; Path=/; HttpOnly")
			return c.body(JSON.stringify(gqlStatus))		
		}	

		// default to error
		c.status(200)
		c.header('Content-Type', 'application/json')
		return c.body(JSON.stringify({ status: { 'code': 411, 'message': 'sign up error detected!'}, user: null }))

	} catch (err) {
		c.status(200)
		c.header('Content-Type', 'application/json')
		return c.body(JSON.stringify({ status: { 'code': 410, 'message': 'system error detected!'}, user: null }))
	}
})

export default app