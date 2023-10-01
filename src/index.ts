import { connect } from '@planetscale/database';
import * as jose from 'jose';

export interface Env {
	db_host: string;
	db_name: string;

	// us-west-2 - (primary) write/read
	db_user_1: string;
	db_pw_1: string;

	// all regions below are read replicas

	// us-east-2
	db_user_2: string;
	db_pw_2: string;

	// ap-northeast-1
	db_user_3: string;
	db_pw_3: string;

	// ap-southeast-1
	db_user_4: string;
	db_pw_4: string;

	// sa-east-1 
	db_user_5: string;
	db_pw_5: string;

	// ap-south-1
	db_user_6: string;
	db_pw_6: string;

	// eu-central-1 
	db_user_7: string;
	db_pw_7: string;

	// ap-southeast-2
	db_user_8: string;
	db_pw_8: string;

	// eu-west-2
	db_user_9: string;
	db_pw_9: string;

	// us-east-1
	db_user_10: string;
	db_pw_10: string;
}

interface CookieOptions {
	domain?: string;
	path?: string;
	httpOnly?: boolean;
	secure?: boolean;
	sameSite?: 'strict' | 'lax' | 'none';
	maxAge?: number;
}

interface dbUser {
	id: number;
	oid: number;
	username: string;
	email: string;
	password: string;
	phone: string;
	picture: string;
}

interface UserJwt {
	role: string;
	username: string;
	email: string;
}

interface loginForm {
	username: string;
	password: string;
}

// airport code represents region of running worker
// this is used to determine which AWS region to use
// for planetscale read replica
//
// this should probably be placed into a KV store
// so other workers can access it
const regionMap = new Map([

	// AFRICA
	['ACC', 'eu-central-1'], // Accra, Ghana
    ['ALG', 'eu-central-1'], // Algiers, Algeria
    ['AAE', 'eu-central-1'], // Annaba, Algeria
    ['TNR', 'eu-central-1'], // Antananarivo, Madagascar
    ['CPT', 'eu-central-1'], // Cape Town, South Africa
    ['CMN', 'eu-central-1'], // Casablanca, Morocco
    ['DKR', 'eu-central-1'], // Dakar, Senegal
    ['DAR', 'eu-central-1'], // Dar Es Salaam, Tanzania
    ['JIB', 'eu-central-1'], // Djibouti City, Djibouti
    ['DUR', 'eu-central-1'], // Durban, South Africa
    ['GBE', 'eu-central-1'], // Gaborone, Botswana
    ['HRE', 'eu-central-1'], // Harare, Zimbabwe
    ['JNB', 'eu-central-1'], // Johannesburg, South Africa
    ['KGL', 'eu-central-1'], // Kigali, Rwanda
    ['LOS', 'eu-central-1'], // Lagos, Nigeria
    ['LAD', 'eu-central-1'], // Luanda, Angola
    ['MPM', 'eu-central-1'], // Maputo, Mozambique
    ['MBA', 'eu-central-1'], // Mombasa, Kenya
    ['NBO', 'eu-central-1'], // Nairobi, Kenya
	['ORN', 'eu-central-1'], // Oran, Algeria
    ['OUA', 'eu-central-1'], // Ouagadougou, Burkina Faso
    ['MRU', 'eu-central-1'], // Port Louis, Mauritius
    ['RUN', 'eu-central-1'], // Réunion, France
    ['TUN', 'eu-central-1'], // Tunis, Tunisia
    ['FIH', 'eu-central-1'], // Kinshasa, DR Congo
    ['CAI', 'eu-central-1'], // Cairo, Egypt

	// ASIA
	['AMD', 'ap-south-1'], // Ahmedabad, India
	['ALA', 'ap-south-1'], // Almaty, Kazakhstan
	['BLR', 'ap-south-1'], // Bangalore, India
	['BKK', 'ap-southeast-1'], // Bangkok, Thailand
	['BWN', 'ap-southeast-1'], // Bandar Seri Begawan, Brunei
	['BBI', 'ap-south-1'], // Bhubaneswar, India
	['CEB', 'ap-southeast-1'], // Cebu, Philippines
	['IXC', 'ap-south-1'], // Chandigarh, India
	['CGD', 'ap-northeast-1'], // Changde, China
	['MAA', 'ap-south-1'], // Chennai, India
	['CNX', 'ap-southeast-1'], // Chiang Mai, Thailand
	['CGP', 'ap-south-1'], // Chittagong, Bangladesh
	['CMB', 'ap-south-1'], // Colombo, Sri Lanka
	['DAC', 'ap-south-1'], // Dhaka, Bangladesh
	['FUO', 'ap-northeast-1'], // Foshan, China
	['FUK', 'ap-northeast-1'], // Fukuoka, Japan
	['FOC', 'ap-northeast-1'], // Fuzhou, China
	['CAN', 'ap-northeast-1'], // Guangzhou, China
	['HAK', 'ap-northeast-1'], // Haikou, China
	['HAN', 'ap-northeast-1'], // Hanoi, Vietnam
	['SJW', 'ap-northeast-1'], // Hengshui, China
	['SGN', 'ap-northeast-1'], // Ho Chi Minh City, Vietnam
	['HKG', 'ap-northeast-1'], // Hong Kong
	['HYD', 'ap-south-1'], // Hyderabad, India
	['ISB', 'ap-south-1'], // Islamabad, Pakistan
	['CGK', 'ap-southeast-1'], // Jakarta, Indonesia
	['JSR', 'ap-south-1'], // Jashore, Bangladesh
	['TNA', 'ap-northeast-1'], // Jinan, China
	['JHB', 'ap-southeast-1'], // Johor Bahru, Malaysia
	['KNU', 'ap-south-1'], // Kanpur, India
	['KHH', 'ap-northeast-1'], // Kaohsiung City, Taiwan
	['KHI', 'ap-south-1'], // Karachi, Pakistan
	['KTM', 'ap-south-1'], // Kathmandu, Nepal
	['KHV', 'ap-south-1'], // Khabarovsk, Russia
	['CCU', 'ap-south-1'], // Kolkata, India
	['KJA', 'ap-south-1'], // Krasnoyarsk, Russia
	['KUL', 'ap-southeast-1'], // Kuala Lumpur, Malaysia
	['LHE', 'ap-south-1'], // Lahore, Pakistan
	['PKX', 'ap-northeast-1'], // Langfang, China
	['LHW', 'ap-northeast-1'], // Lanzhou, China
	['LYA', 'ap-northeast-1'], // Luoyang, China
	['MFM', 'ap-northeast-1'], // Macau
	['MLE', 'ap-southeast-1'], // Malé, Maldives
	['MDL', 'ap-south-1'], // Mandalay, Myanmar
	['MNL', 'ap-southeast-1'], // Manila, Philippines
	['BOM', 'ap-south-1'], // Mumbai, India
	['NAG', 'ap-south-1'], // Nagpur, India
	['OKA', 'ap-northeast-1'], // Naha, Japan
	['DEL', 'ap-south-1'], // New Delhi, India
	['KIX', 'ap-northeast-1'], // Osaka, Japan
	['PAT', 'ap-south-1'], // Patna, India
	['PNH', 'ap-southeast-1'], // Phnom Penh, Cambodia
	['TAO', 'ap-northeast-1'], // Qingdao, China
	['ICN', 'ap-northeast-1'], // Seoul, South Korea
	['SHA', 'ap-northeast-1'], // Shanghai, China
	['SIN', 'ap-southeast-1'], // Singapore, Singapore
	['URT', 'ap-southeast-1'], // Surat Thani, Thailand
	['TPE', 'ap-northeast-1'], // Taipei
	['TAS', 'ap-south-1'], // Tashkent, Uzbekistan
	['PBH', 'ap-south-1'], // Thimphu, Bhutan
	['TSN', 'ap-northeast-1'], // Tianjin, China
	['NRT', 'ap-northeast-1'], // Tokyo, Japan
	['ULN', 'ap-south-1'], // Ulaanbaatar, Mongolia
	['VTE', 'ap-southeast-1'], // Vientiane, Laos
	['KHN', 'ap-northeast-1'], // Xinyu, China
	['RGN', 'ap-southeast-1'], // Yangon, Myanmar
	['EVN', 'ap-south-1'], // Yerevan, Armenia
	['JOG', 'ap-southeast-1'], // Yogyakarta, Indonesia
	['CGO', 'ap-northeast-1'], // Zhengzhou, China
	['CGQ', 'ap-northeast-1'], // Changchun, China
	['ZGN', 'ap-northeast-1'], // Zhongshan, China
	['CGY', 'ap-southeast-1'], // Cagayan de Oro, Philippines
	['CSX', 'ap-northeast-1'], // Changsha, China
	['WHU', 'ap-northeast-1'], // Wuhu, China
	['HYN', 'ap-northeast-1'], // Taizhou, China
	['COK', 'ap-northeast-1'], // Kochi, India
	['XMN', 'ap-northeast-1'], // Xiamen, China
	['DPS', 'ap-southeast-1'], // Denpasar, Indonesia
	['CNN', 'ap-south-1'], // Kannur, India
	['SZX', 'ap-northeast-1'], // Shenzhen, China
	['KWE', 'ap-northeast-1'], // Guiyang, China 
	['WUX', 'ap-northeast-1'], // Wuxi, China  
	['YNJ', 'ap-northeast-1'], // Yanbian, China 
	['HGH', 'ap-northeast-1'], // Shaoxing, China 
	['CZX', 'ap-northeast-1'], // Changzhou, China

	// EUROPE
	['AMS', 'eu-west-2'], // Amsterdam, Netherlands
	['ATH', 'eu-central-1'], // Athens, Greece
	['BCN', 'eu-west-2'], // Barcelona, Spain
	['BEG', 'eu-central-1'], // Belgrade, Serbia
	['TXL', 'eu-central-1'], // Berlin, Germany
	['BTS', 'eu-central-1'], // Bratislava, Slovakia
	['BRU', 'eu-central-1'], // Brussels, Belgium
	['OTP', 'eu-central-1'], // Bucharest, Romania
	['BUD', 'eu-central-1'], // Budapest, Hungary
	['KIV', 'eu-central-1'], // Chișinău, Moldova
	['CPH', 'eu-west-2'], // Copenhagen, Denmark
	['ORK', 'eu-west-2'], // Cork, Ireland
	['DUB', 'eu-west-2'], // Dublin, Ireland
	['DUS', 'eu-central-1'], // Düsseldorf, Germany
	['EDI', 'eu-west-2'], // Edinburgh, United Kingdom
	['FRA', 'eu-central-1'], // Frankfurt, Germany
	['GVA', 'eu-west-2'], // Geneva, Switzerland
	['GOT', 'eu-central-1'], // Gothenburg, Sweden
	['HAM', 'eu-central-1'], // Hamburg, Germany
	['HEL', 'eu-central-1'], // Helsinki, Finland
	['IST', 'eu-central-1'], // Istanbul, Turkey
	['ADB', 'eu-central-1'], // Izmir, Turkey
	['KBP', 'eu-central-1'], // Kyiv, Ukraine
	['LIS', 'eu-west-2'], // Lisbon, Portugal
	['LHR', 'eu-west-2'], // London, United Kingdom
	['LUX', 'eu-central-1'], // Luxembourg City, Luxembourg
	['MAD', 'eu-west-2'], // Madrid, Spain
	['MAN', 'eu-west-2'], // Manchester, United Kingdom
	['MRS', 'eu-west-2'], // Marseille, France
	['MXP', 'eu-central-1'], // Milan, Italy
	['MSQ', 'eu-central-1'], // Minsk, Belarus
	['DME', 'eu-central-1'], // Moscow, Russia
	['MUC', 'eu-central-1'], // Munich, Germany
	['LCA', 'eu-central-1'], // Nicosia, Cyprus
	['OSL', 'eu-central-1'], // Oslo, Norway
	['PMO', 'eu-west-2'], // Palermo, Italy
	['CDG', 'eu-west-2'], // Paris, France
	['PRG', 'eu-central-1'], // Prague, Czech Republic
	['KEF', 'eu-west-2'], // Reykjavík, Iceland
	['RIX', 'eu-central-1'], // Riga, Latvia
	['FCO', 'eu-central-1'], // Rome, Italy
	['LED', 'eu-central-1'], // Saint Petersburg, Russia
	['SOF', 'eu-central-1'], // Sofia, Bulgaria
	['ARN', 'eu-central-1'], // Stockholm, Sweden
	['STR', 'eu-central-1'], // Stuttgart, Germany
	['TLL', 'eu-central-1'], // Tallinn, Estonia
	['TBS', 'eu-central-1'], // Tbilisi, Georgia
	['SKG', 'eu-central-1'], // Thessaloniki, Greece
	['TIA', 'eu-central-1'], // Tirana, Albania
	['KLD', 'eu-central-1'], // Tver, Russian Federation
	['VIE', 'eu-central-1'], // Vienna, Austria
	['VNO', 'eu-central-1'], // Vilnius, Lithuania
	['WAW', 'eu-central-1'], // Warsaw, Poland
	['SVX', 'eu-central-1'], // Yekaterinburg, Russia
	['ZAG', 'eu-central-1'], // Zagreb, Croatia
	['ZRH', 'eu-west-2'], // Zürich, Switzerland
	['LYS', 'eu-west-2'], // Lyon, France
	['BOD', 'eu-west-2'], // Bordeaux, France - (BOD)

	// LATIN AMERICA & CARIBBEAN
	['QWJ', 'sa-east-1'], // Americana, Brazil
	['ARI', 'sa-east-1'], // Arica, Chile
	['ASU', 'sa-east-1'], // Asunción, Paraguay
	['BEL', 'sa-east-1'], // Belém, Brazil
	['CNF', 'sa-east-1'], // Belo Horizonte, Brazil
	['BNU', 'sa-east-1'], // Blumenau, Brazil
	['BOG', 'sa-east-1'], // Bogotá, Colombia
	['BSB', 'sa-east-1'], // Brasilia, Brazil
	['EZE', 'sa-east-1'], // Buenos Aires, Argentina
	['CFC', 'sa-east-1'], // Caçador, Brazil
	['VCP', 'sa-east-1'], // Campinas, Brazil
	['COR', 'sa-east-1'], // Córdoba, Argentina
	['CGB', 'sa-east-1'], // Cuiabá, Brazil
	['CWB', 'sa-east-1'], // Curitiba, Brazil
	['FLN', 'sa-east-1'], // Florianopolis, Brazil
	['FOR', 'sa-east-1'], // Fortaleza, Brazil
	['GEO', 'sa-east-1'], // Georgetown, Guyana
	['GYN', 'sa-east-1'], // Goiânia, Brazil
	['GUA', 'sa-east-1'], // Guatemala City, Guatemala
	['GYE', 'sa-east-1'], // Guayaquil, Ecuador
	['ITJ', 'sa-east-1'], // Itajaí, Brazil
	['JOI', 'sa-east-1'], // Joinville, Brazil
	['JDO', 'sa-east-1'], // Juazeiro do Norte, Brazil
	['LIM', 'sa-east-1'], // Lima, Peru
	['MAO', 'sa-east-1'], // Manaus, Brazil
	['MDE', 'sa-east-1'], // Medellín, Colombia
	['NQN', 'sa-east-1'], // Neuquén, Argentina
	['PTY', 'sa-east-1'], // Panama City, Panama
	['PBM', 'sa-east-1'], // Paramaribo, Suriname
	['POA', 'sa-east-1'], // Porto Alegre, Brazil
	['UIO', 'sa-east-1'], // Quito, Ecuador
	['REC', 'sa-east-1'], // Recife, Brazil
	['RAO', 'sa-east-1'], // Ribeirao Preto, Brazil
	['GIG', 'sa-east-1'], // Rio de Janeiro, Brazil
	['SSA', 'sa-east-1'], // Salvador, Brazil
	['SJO', 'sa-east-1'], // San José, Costa Rica
	['SCL', 'sa-east-1'], // Santiago, Chile
	['SDQ', 'sa-east-1'], // Santo Domingo, Dominican Republic
	['SJP', 'sa-east-1'], // São José do Rio Preto, Brazil
	['SJK', 'sa-east-1'], // São José dos Campos, Brazil
	['GRU', 'sa-east-1'], // São Paulo, Brazil
	['SOD', 'sa-east-1'], // Sorocaba, Brazil
	['GND', 'sa-east-1'], // St. George's, Grenada
	['TGU', 'us-east-1'], // Tegucigalpa, Honduras
	['NVT', 'sa-east-1'], // Timbó, Brazil
	['UDI', 'sa-east-1'], // Uberlândia, Brazil
	['VIX', 'sa-east-1'], // Vitoria, Brazil
	['CUR', 'sa-east-1'], // Willemstad, Curaçao
	['CAW', 'sa-east-1'], // Campos dos Goytacazes, Brazil
	['XAP', 'sa-east-1'], // Chapeco, Brazil
	['BGI', 'us-east-1'], // Bridgetown, Barbados

	// MIDDLE EAST
	['AMM', 'eu-central-1'], // Amman, Jordan
	['LLK', 'eu-central-1'], // Astara, Azerbaijan
	['BGW', 'eu-central-1'], // Baghdad, Iraq
	['GYD', 'eu-central-1'], // Baku, Azerbaijan
	['BSR', 'eu-central-1'], // Basra, Iraq
	['BEY', 'eu-central-1'], // Beirut, Lebanon
	['DMM', 'eu-central-1'], // Dammam, Saudi Arabia
	['DOH', 'eu-central-1'], // Doha, Qatar
	['DXB', 'eu-central-1'], // Dubai, United Arab Emirates
	['EBL', 'eu-central-1'], // Erbil, Iraq
	['HFA', 'eu-central-1'], // Haifa, Israel
	['JED', 'eu-central-1'], // Jeddah, Saudi Arabia
	['KWI', 'eu-central-1'], // Kuwait City, Kuwait
	['BAH', 'eu-central-1'], // Manama, Bahrain
	['MCT', 'eu-central-1'], // Muscat, Oman
	['NJF', 'eu-central-1'], // Najaf, Iraq
	['XNH', 'eu-central-1'], // Nasiriyah, Iraq
	['ZDM', 'eu-central-1'], // Ramallah
	['RUH', 'eu-central-1'], // Riyadh, Saudi Arabia
	['ISU', 'eu-central-1'], // Sulaymaniyah, Iraq
	['TLV', 'eu-central-1'], // Tel Aviv, Israel

	// NORTH AMERICA
	['IAD', 'us-east-1'], // Ashburn, VA, United States
	['ATL', 'us-east-1'], // Atlanta, GA, United States
	['BOS', 'us-east-1'], // Boston, MA, United States
	['BUF', 'us-east-1'], // Buffalo, NY, United States
	['YYC', 'us-west-2'], // Calgary, AB, Canada
	['CLT', 'us-east-1'], // Charlotte, NC, United States
	['ORD', 'us-east-2'], // Chicago, IL, United States
	['CMH', 'us-east-2'], // Columbus, OH, United States
	['DFW', 'us-west-2'], // Dallas, TX, United States
	['DEN', 'us-west-2'], // Denver, CO, United States
	['DTW', 'us-east-2'], // Detroit, MI, United States
	['HNL', 'us-west-2'], // Honolulu, HI, United States
	['IAH', 'us-west-2'], // Houston, TX, United States
	['IND', 'us-east-2'], // Indianapolis, IN, United States
	['JAX', 'us-east-1'], // Jacksonville, FL, United States
	['MCI', 'us-east-2'], // Kansas City, MO, United States
	['LAS', 'us-west-2'], // Las Vegas, NV, United States
	['LAX', 'us-west-2'], // Los Angeles, CA, United States
	['MFE', 'us-west-2'], // McAllen, TX, United States
	['MEM', 'us-east-2'], // Memphis, TN, United States
	['MEX', 'us-west-2'], // Mexico City, Mexico
	['MIA', 'us-east-1'], // Miami, FL, United States
	['MSP', 'us-west-2'], // Minneapolis, MN, United States
	['MGM', 'us-east-1'], // Montgomery, AL, United States
	['YUL', 'us-east-2'], // Montréal, QC, Canada
	['BNA', 'us-east-2'], // Nashville, United States
	['EWR', 'us-east-1'], // Newark, NJ, United States
	['ORF', 'us-east-1'], // Norfolk, VA, United States
	['OMA', 'us-east-2'], // Omaha, NE, United States
	['YOW', 'us-east-1'], // Ottawa, Canada
	['PHL', 'us-east-2'], // Philadelphia, United States
	['PHX', 'us-west-2'], // Phoenix, AZ, United States
	['PIT', 'us-east-1'], // Pittsburgh, PA, United States
	['PDX', 'us-west-2'], // Portland, OR, United States
	['QRO', 'us-west-2'], // Queretaro, MX, Mexico
	['RIC', 'us-east-1'], // Richmond, VA, United States
	['SMF', 'us-west-2'], // Sacramento, CA, United States
	['SLC', 'us-west-2'], // Salt Lake City, UT, United States
	['SAN', 'us-west-2'], // San Diego, CA, United States
	['SJC', 'us-west-2'], // San Jose, CA, United States
	['YXE', 'us-east-2'], // Saskatoon, SK, Canada
	['SEA', 'us-west-2'], // Seattle, WA, United States
	['FSD', 'us-east-2'], // Sioux Falls, South Dakota
	['STL', 'us-east-1'], // St. Louis, MO, United States
	['TLH', 'us-east-1'], // Tallahassee, FL, United States
	['YYZ', 'us-east-1'], // Toronto, ON, Canada
	['YVR', 'us-west-2'], // Vancouver, BC, Canada
	['YWG', 'us-west-2'], // Winnipeg, MB, Canada
	['SFO', 'us-west-2'], // San Francisco, United States
	['KIN', 'us-east-1'], // Kingston, Jamaica
	['BGR', 'us-west-2'], // Bangor, United States
	['AUS', 'us-west-2'], // Austin, United States
	['ABQ', 'us-west-2'], // Albuquerque, United States
	['GDL', 'us-west-2'], // Guadalajara, Mexico
	['SAT', 'us-west-2'], // San Antonio, United States
	['CLE', 'us-east-1'], // Cleveland, United States
	['RDU', 'us-east-1'], // Durham, United States
	['OKC', 'us-east-1'], // Oklahoma City, United States

	// OCEANIA
	['ADL', 'ap-southeast-2'], // Adelaide, SA, Australia
	['AKL', 'ap-southeast-2'], // Auckland, New Zealand
	['BNE', 'ap-southeast-2'], // Brisbane, QLD, Australia
	['CBR', 'ap-southeast-2'], // Canberra, ACT, Australia
	['CHC', 'ap-southeast-2'], // Christchurch, New Zealand
	['GUM', 'ap-southeast-2'], // Hagatna, Guam
	['HBA', 'ap-southeast-2'], // Hobart, Australia
	['MEL', 'ap-southeast-2'], // Melbourne, VIC, Australia
	['NOU', 'ap-southeast-2'], // Noumea, New Caledonia
	['PER', 'ap-southeast-2'], // Perth, WA, Australia
	['SYD', 'ap-southeast-2'], // Sydney, NSW, Australia
	['PPT', 'ap-southeast-2'], // Tahiti, French Polynesia
]);

const corsOptions = {
	origin: ['https://id.fromafri.ca'],
	credentials: true,
	allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Access-Control-Allow-Origin'],
}

const corsHeaders = {
	'Access-Control-Allow-Origin': corsOptions.origin.join(', '),
	'Access-Control-Allow-Credentials': corsOptions.credentials.toString(),
	'Access-Control-Allow-Headers': corsOptions.allowedHeaders.join(', '),
	'Access-Control-Allow-Methods': 'GET,HEAD,PUT,PATCH,POST,DELETE',
	'Access-Control-Max-Age': '1000',
}

// Helper function to sign a JWT
async function signToken(user: UserJwt): Promise<string> {
	const payload = {
		role: user.role,
		user: user.username,
		email: user.email,
	};

	const secret = new TextEncoder().encode(
		'cc7e0d44fd473002f1c42167459001140ec6389b7353f8088f4d9a95f2f596f2',
	  )
	const alg = 'HS256'

	const token = await new jose.SignJWT(payload)
										.setProtectedHeader({ alg })
										.setIssuedAt()
										.setIssuer('urn:example:issuer')
										.setAudience('urn:example:audience')
										.setExpirationTime('2h')
										.sign(secret)

	return token;
}

async function hashPassword(password: string) {
	const encoder = new TextEncoder();
	const data = encoder.encode(password);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
	return hashHex;
}

async function readRequestBody(request: Request) {
	const contentType = request.headers.get("content-type");

	console.log(contentType);

	switch (contentType) {
		case 'application/json': {
			return JSON.stringify(await request.json());
		}
		case 'application/text': {
			return request.text();
		}
		case 'text/html': {
			return request.text();
		}
		case 'application/x-www-form-urlencoded': {
			const formData = await request.formData();
			const body = {} as any;
			for (const entry of formData.entries()) {
				body[entry[0]] = entry[1];
			}
			return JSON.stringify(body);
		}
		case 'form': {
			const formData = await request.formData();
			const body = {} as any;
			for (const entry of formData.entries()) {
				body[entry[0]] = entry[1];
			}
			return JSON.stringify(body);
		}
		default: {
			// Perhaps some other type of data was submitted in the form
			// like an image, or some other binary data.
			return "a file";
		}
	}
  }

  export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {

		let returnResponse: Response;

		switch (request.method.toLowerCase()) {

			// handle CORS preflight request
			case "options":
				returnResponse = new Response("ok", { headers: corsHeaders });
			break;

			// redirect GET requests to sign in page
			// because this serves no purpose for browsers using GET
			case "get":
				console.log('redirecting to sign in page because this is a GET request');
				returnResponse = new Response("ok", {
					status: 301,
					headers: {
					  'Location': 'https://id.fromafri.ca',
					  ...corsHeaders,
					}
				});
			break;

			// handle POST requests
			case "post":
				let colo: string = '';
				if (request.cf && request.cf.colo) {
					colo = request.cf.colo as string;
				}
		
				const defaultValue: string = 'us-west-2';
				const awsRegion = regionMap.get(colo) || defaultValue;
				console.log('Worker is running in: ' + colo +' and will use AWS region: ' + awsRegion);
		
				const DATABASE_HOST: string = env.db_host;
				const DATABASE_NAME: string = env.db_name;
		
				let DATABASE_USERNAME: string = '';
				let DATABASE_PASSWORD: string = '';
		
				switch (awsRegion) {
					case 'us-west-2':
						DATABASE_USERNAME = env.db_user_1;
						DATABASE_PASSWORD = env.db_pw_1;
					break;
					case 'us-east-2':
						DATABASE_USERNAME = env.db_user_2;
						DATABASE_PASSWORD = env.db_pw_2;
					break;
					case 'ap-northeast-1':
						DATABASE_USERNAME = env.db_user_3;
						DATABASE_PASSWORD = env.db_pw_3;
					break;
					case 'ap-southeast-1':
						DATABASE_USERNAME = env.db_user_4;
						DATABASE_PASSWORD = env.db_pw_4;
					break;
					case 'sa-east-1':
						DATABASE_USERNAME = env.db_user_5;
						DATABASE_PASSWORD = env.db_pw_5;
					break;
					case 'ap-south-1':
						DATABASE_USERNAME = env.db_user_6;
						DATABASE_PASSWORD = env.db_pw_6;
					break;
					case 'eu-central-1':
						DATABASE_USERNAME = env.db_user_7;
						DATABASE_PASSWORD = env.db_pw_7;
					break;
					case 'ap-southeast-2':
						DATABASE_USERNAME = env.db_user_8;
						DATABASE_PASSWORD = env.db_pw_8;
					break;
					case 'eu-west-2':
						DATABASE_USERNAME = env.db_user_9;
						DATABASE_PASSWORD = env.db_pw_9;
					break;
					case 'us-east-1':
						DATABASE_USERNAME = env.db_user_10;
						DATABASE_PASSWORD = env.db_pw_10;
					break;
					default:
						DATABASE_USERNAME = env.db_user_1;
						DATABASE_PASSWORD = env.db_pw_1;
					break;
				}
		
				const config = {
					host: DATABASE_HOST,
					username: DATABASE_USERNAME,
					password: DATABASE_PASSWORD,
					fetch: (url: any, init: any) => {
						delete init['cache']
						return fetch(url, init)
					}
				}
				const conn = connect(config) // connect to mysql

				const reqBody = await request.json() as loginForm;

				const username = reqBody.username;
				const password = reqBody.password;
				
				// TODO: sanitize input for security
				const data = await conn.execute('SELECT * FROM '+ env.db_name +'.users WHERE `username`="'+ username +'" LIMIT 1;') // execute query

				// hash input for db comparison
				const passHash = await hashPassword(password as string);

				let databaseCandidate = data.rows[0] as dbUser;

				if (passHash === databaseCandidate.password)
				{
					let jwt: UserJwt = {
						'role': 'user',
						'username': databaseCandidate.username,
						'email': databaseCandidate.email,
					}
					// sign the JWT, user now logged in
					const token = await signToken(jwt);

					// TODO: store auth session with details
					let returnJson = {
						statusCode: 200,
					}

					returnResponse = new Response(JSON.stringify(returnJson), {
						status: 200,
						headers: {
						'Content-Type': 'application/json',
						'Set-Cookie': `FawlUser=${token}; Domain=.fromafri.ca; Path=/; HttpOnly`,
						...corsHeaders,
						}
					});
				} else {
					console.log('login error detected');

					let returnJson = {
						statusCode: 900,
					}

					// incorrect password, set error cookie
					returnResponse = new Response(JSON.stringify(returnJson), {
						status: 200,
						headers: {
						'Content-Type': 'application/json',
						'Set-Cookie': `FawlError=true; Domain=.fromafri.ca; Path=/;`,
						...corsHeaders,
						}
					});
				}
			break;

			// default treated like a GET request
			default:
				console.log('redirecting to sign in page because this is an unknown/undesired request');
				returnResponse = new Response("ok", {
					status: 301,
					headers: {
					'Location': 'https://id.fromafri.ca',
					...corsHeaders,
					}
				});
			break;
		}

		// return whatever comes out the other side of the switch() statement
		return returnResponse;
	},
};
