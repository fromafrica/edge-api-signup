import {
	signToken,
	hashPassword, 
} from '@fromafrica/edge-api'
import { connect } from '@planetscale/database'
import { Hono } from 'hono'
import * as postmark from "postmark"
import { customAlphabet } from 'nanoid'

type Bindings = {
	ENVIRONMENT: string;
	INVALIDTOKENS: KVNamespace;
	HMAC: string;
  }

const app = new Hono<{ Bindings: Bindings }>()

app.options('*', (c) => {
    c.header('Access-Control-Allow-Origin', c.env.ENVIRONMENT === 'dev' ? 'https://id.fromafrica.local.host' : 'https://id.fromafri.ca')
	c.header('Access-Control-Allow-Methods', 'POST, OPTIONS')
	c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Access-Control-Allow-Origin')
	c.header('Access-Control-Expose-Headers', 'Content-Length')
	c.header('Access-Control-Allow-Credentials', 'true')

    return c.text('', 204)
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

	const config = {
		host: c.env.DATABASE_HOST,
		username: c.env.DATABASE_USERNAME,
		password: c.env.DATABASE_PASSWORD,
		fetch: (url: any, init: any) => {
			delete init['cache']
			return fetch(url, init)
		}
	}
	
	const conn = connect(config) // connect to mysql


	const reqBody = await c.req.json();

	if (!reqBody.username || !reqBody.email || !reqBody.password) {
		c.status(200)
		c.header('Content-Type', 'application/json')
		return c.body('{ "error": "signup error detected." }')
	}

	const username = reqBody.username;
	const email = reqBody.email;
	const password = reqBody.password;
	
	const passHash = await hashPassword(password as string);

	const nanoid = customAlphabet('123456789ABCDEFGHIJKLMNPQRSTVWXYZabcdefghijklmnprstvwxyz', 12)
	const id = nanoid()

	const json = JSON.stringify({
		'user': username,
		'email': email
	})

	// TODO: SANITIZE INPUT
	let query = "INSERT into fawlmain.users (id, password, json) VALUES ('"+ id +"', '"+ passHash +"', '"+ json +"');"

	try {
		const data = await conn.execute(query) // execute query

		let jwt: userJwt = {
			'role': 'user',
			'username': username
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
		return c.json('{ "statusCode": "200" }')
	
	} catch (err) {
		console.error(err)
		c.status(200)
		c.header('Content-Type', 'application/json')
		return c.body('{ "error": "system error detected!" }')
	}
})

export default app