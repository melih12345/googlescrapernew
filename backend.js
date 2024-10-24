const express = require('express');
const { spawn } = require('child_process');
const bodyParser = require('body-parser');
const app = express();
const crypto = require('crypto');
const multer = require('multer');
const mysql = require('mysql');
const util = require('util');
const axios = require('axios');
const upload = multer();
const Parser = require('rss-parser');
const parser = new Parser();
const fetch = require('cross-fetch');
const moment = require('moment-timezone');
const xmlrpc = require('xmlrpc');
const cheerio = require('cheerio');
const fs = require('fs');
const sharp = require('sharp');
const { IgApiClient } = require('instagram-private-api');
const request = require('request');
const { Telegraf } = require('telegraf')
const cron = require('node-cron');

const {sorgu1} = require('./myfunc');

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'db'
});


const queryAsync = util.promisify(connection.query).bind(connection);

function generateRandomNumber() {
  return Math.floor(Math.random() * 10000);
}
// async function defineCronJobs() {
	// const rows = await queryAsync('SELECT * FROM cron WHERE status="1"');
	// rows.forEach(row => {
    // cron.schedule(row.time, () => {
		// if(row.time
		// const taramarows = await queryAsync('SELECT * FROM cron WHERE status="1"');
	  
    // }, { scheduled: true, timezone: 'Europe/Istanbul' });
  // });
// }

connection.connect(async (err) => {
  if (err) throw err;
  console.log('MySQL bağlantısı başarıyla sağlandı.');
  // await defineCronJobs();
});

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
function formatTextForTelegram(inputText) {
	let outputText = "";
	outputText = inputText.replace(/<h1>/g, "<b>").replace(/<\/h1>/g, "</b>\n");
	outputText = outputText.replace(/<h2>/g, "<b>").replace(/<\/h2>/g, "</b>\n");
	outputText = outputText.replace(/<h3>/g, "<b>").replace(/<\/h3>/g, "</b>\n");
	outputText = outputText.replace(/<h4>/g, "<b>").replace(/<\/h4>/g, "</b>\n");
	outputText = outputText.replace(/<h5>/g, "<b>").replace(/<\/h5>/g, "</b>\n");
	outputText = outputText.replace(/\[embed\].*?\[\/embed\]/g, "");
	outputText = outputText.replace(/<br>/g, "\n");
	outputText = outputText.replace(/<\/br>/g, "\n");
	outputText = outputText.replace(/<\/p>/g, "\n");
	outputText = outputText.replace(/<(?!b)(?!\/b)(?!i)(?!\/i)(?!a)(?!\/a).*?>/gi, "");
	outputText = outputText.replace(/<img\b[^>]*>/gi, "");
  return outputText;
}
function sanitizeContentTelegram(content) {
	const sanitizedContent = content.replace(/<br\s*\/?>/gi, '\n\n');
	const sanitizedContent2 = sanitizedContent.replace(/<(h[1-5])>/gi, '[b]'); 
	const sanitizedContent3 = sanitizedContent2.replace(/<[^>]+>/g, '');
	const sanitizedContent4 = sanitizedContent3.replace(/\[embed\].*?\[\/embed\]/g, '');
	return sanitizedContent4;
}
function sanitizeContent(content) {
	const sanitizedContent = content.replace(/<br\s*\/?>/gi, '\u{2063}\n ');
	const cleanedContent = sanitizedContent.replace(/<[^>]+>/g, '');
	return cleanedContent;
}
async function readImage(imgpath) {
  try {
    const data = await fs.promises.readFile(imgpath);
    return data;
  } catch (error) {
    console.error(error);
  }
}
function randomBetweenZeroAndHalf() {
  return Math.random() * 0.5;
}
async function seo(s) {
	const tr = [/ğ/g, /ü/g, /ş/g, /ı/g, /i/g, /ö/g, /ç/g, /[^a-zA-Z0-9\s]/g];
	const eng = ['g', 'u', 's', 'i', 'i', 'o', 'c', '-'];

	s = s.toLowerCase();
	for (let i = 0; i < tr.length; i++) {
	   s = s.replace(tr[i], eng[i]);
	}
	s = s.replace(/&amp;amp;amp;amp;amp;amp;amp;amp;amp;.+?;/gi, '');
	s = s.replace(/\s+/g, '-');
	s = s.replace(/-+/g, '-');
	s = s.replace(/#/g, '');
	s = s.replace(/\./g, '');
	s = s.replace(/^-+|-+$/g, '');
	return s;

}

async function getMediaLinks(html) {
  const embeddedHtml = html.replace(/\[embed\](.*?)\[\/embed\]/g, '<video src="$1"></video>');
  const $ = cheerio.load(embeddedHtml);
  const links = [];
  $('video[src],img[src], source[src]').each((i, el) => {
    const link = $(el).attr('src');
	if (link && link.match(/\.?(jpg|jpeg|png|mp4)$/i)) {
	  links.push(link);
	}
  });
  return links;
}
async function getMediaLinksVideo(html) {
  const embeddedHtml = html.replace(/\[embed\](.*?)\[\/embed\]/g, '<video src="$1"></video>');
  const $ = cheerio.load(embeddedHtml);
  const links = [];
  $('video[src]').each((i, el) => {
    const link = $(el).attr('src');
    if (link && link.match(/\.(mp4)$/i)) {
      links.push(link);
    }
  });
  return links;
}

async function downloadFile(url) {
  const response = await axios({
    url: url,
    method: 'GET',
    responseType: 'arraybuffer'
  });
  return response.data;
}

async function postTotelegram(links,caption) {
	const items = [];
	for (const link of links) {
		const type = link.endsWith('.mp4') ? 'video' : 'photo';
		const file = await downloadFile(link);
		if(items.length === 0){
			items.push({ type, media: { source: file }, caption: caption , parse_mode: "HTML" });
		} else {
			items.push({ type, media: { source: file } });
		}
	}
	return items;
}

async function postToInstagram(links) {
	const items = [];
	for (const link of links) {
		const type = link.endsWith('.mp4') ? 'video' : 'photo';
		const file = await downloadFile(link);
		items.push({ type, file });
	}
	return items;
}
app.post('/postmycontentontelegram2', upload.none(), async (req, res) => {
	const uniqid = req.body.uniqid;
	const content = req.body.content || "";
	const businessid = req.body.businessid || "";
	
	const userdetail = await getUser(uniqid);
	if (!userdetail.status) return res.send({
		status: false,
		response: "Böyle bir kullanıcı bulunamadı."
	});
	
	if (!userdetail.package) return res.send({
		status: false,
		response: "İlk önce bir paket satın almalısınız.",
		redirect: true,
		location: "packages",
		time:2000
	});
	
	const cb = await countbusiness(userdetail.userid , businessid);
	if (!cb.status) return res.send({
		status: false,
		response: "Böyle bir kayıt bulunamadı."
	});
	
		const bot = new Telegraf(userdetail.telegramapi);
		const MAX_CAPTION_LENGTH = 1024;
		const MAX_MESSAGE_LENGTH = 4096;
		const file = await readImage(JSON.parse(cb.data[0]['imgpath'])[0]);
			if(JSON.parse(cb.data[0]['imgpath'])[0] == ""){
				if (!cb.status) return res.send({
					status: false,
					response: "İşletme görseli olmadığı için yazı gönderilemedi."
				});
			}
		const caption = formatTextForTelegram(content);
		if (caption.length <= MAX_CAPTION_LENGTH) {
		  try {
		  const result = await bot.telegram.sendMediaGroup(userdetail.telegramid, [{ type:"photo", media: { source: file }, caption: caption , parse_mode: "HTML" }]);
			return res.send({
			  status: true,
			  response: "Mesaj gönderildi!"
			});
		  } catch (error) {
			return res.send({
			  status: false,
			  response: error.message
			});
		  }
		} else {

		  const captionFirstPart = caption.substring(0, MAX_CAPTION_LENGTH);
		  const captionRemaining = caption.substring(MAX_CAPTION_LENGTH);

		  try {

			const result = await bot.telegram.sendMediaGroup(userdetail.telegramid, [{ type:"photo", media: { source: file }, caption: captionFirstPart , parse_mode: "HTML" }]);
			let replyToMsgId = result[0].message_id;

			let remainingMessage = captionRemaining;
			while (remainingMessage.length > 0) {
			  const currentMessage = remainingMessage.substring(0, MAX_MESSAGE_LENGTH);
			  remainingMessage = remainingMessage.substring(MAX_MESSAGE_LENGTH);
			  const chunk = `${currentMessage.replace(/\n/g, "\n")}`;
			  const opts = { parse_mode: 'HTML' };
			  if (replyToMsgId !== null) {
				opts.reply_to_message_id = replyToMsgId;
			  }
			  const msg = await bot.telegram.sendMessage(userdetail.telegramid, chunk, opts);
			  replyToMsgId = msg.message_id;

			  if (remainingMessage.length === 0) {

				return res.send({
				  status: true,
				  response: "Mesaj gönderildi!"
				});
			  }
			}
		  } catch (error) {
			return res.send({
			  status: false,
			  response: error.message
			});
		  }
		}

});



app.post('/postmycontentontelegram', upload.none(), async (req, res) => {
	const uniqid = req.body.uniqid;
	const content = req.body.content || "";
	const userdetail = await getUser(uniqid);
	if (!userdetail.status) return res.send({
		status: false,
		response: "Böyle bir kullanıcı bulunamadı."
	});
	if (!userdetail.package) return res.send({
		status: false,
		response: "İlk önce bir paket satın almalısınız.",
		redirect: true,
		location: "packages",
		time:2000
	});
	const bot = new Telegraf(userdetail.telegramapi);
	const links = await getMediaLinks(content);
	if(links.length >= 1){
		const MAX_CAPTION_LENGTH = 1024;
		const MAX_MESSAGE_LENGTH = 4096;

		const caption = formatTextForTelegram(content);
		if (caption.length <= MAX_CAPTION_LENGTH) {

		  const postitems = await postTotelegram(links, caption);
		  try {
			const result = await bot.telegram.sendMediaGroup(userdetail.telegramid, postitems);
			return res.send({
			  status: true,
			  response: "Mesaj gönderildi!"
			});
		  } catch (error) {
			return res.send({
			  status: false,
			  response: error.message
			});
		  }
		} else {

		  const captionFirstPart = caption.substring(0, MAX_CAPTION_LENGTH);
		  const captionRemaining = caption.substring(MAX_CAPTION_LENGTH);

		  try {

			const postitems = await postTotelegram(links, captionFirstPart+'..');
			const result = await bot.telegram.sendMediaGroup(userdetail.telegramid, postitems);
			let replyToMsgId = result[0].message_id;

			let remainingMessage = captionRemaining;
			while (remainingMessage.length > 0) {
			  const currentMessage = remainingMessage.substring(0, MAX_MESSAGE_LENGTH);
			  remainingMessage = remainingMessage.substring(MAX_MESSAGE_LENGTH);
			  const chunk = `${currentMessage.replace(/\n/g, "\n")}`;
			  const opts = { parse_mode: 'HTML' };
			  if (replyToMsgId !== null) {
				opts.reply_to_message_id = replyToMsgId;
			  }
			  const msg = await bot.telegram.sendMessage(userdetail.telegramid, chunk, opts);
			  replyToMsgId = msg.message_id;

			  if (remainingMessage.length === 0) {
				return res.send({
				  status: true,
				  response: "Mesaj gönderildi!"
				});
			  }
			}
		  } catch (error) {
			return res.send({
			  status: false,
			  response: error.message
			});
		  }
		}
	}else{
		try {
			const MAX_MESSAGE_LENGTH = 4096;
			const chunks = formatTextForTelegram(content).match(/[\s\S]{1,4096}/g) || [];
			let replyToMsgId = null;
			for (const chunk of chunks) {
			  const opts = { parse_mode: 'HTML' };
			  if (replyToMsgId !== null) {
				opts.reply_to_message_id = replyToMsgId;
			  }
			  const msg = await bot.telegram.sendMessage(userdetail.telegramid, chunk, opts);
			  replyToMsgId = msg.message_id;
			}
			// const result = await bot.telegram.sendMessage(userdetail.telegramid, formatTextForTelegram(content), { parse_mode: 'HTML' })
			return res.send({
				status: true,
				response: "Mesaj gönderildi!"
			});
		} catch (error) {
			return res.send({
				status: false,
				response: error.message
			});
		}
	}

});
app.post('/posttweetmyinstagram', upload.none(), async (req, res) => {
	const uniqid = req.body.uniqid;
	const content = req.body.content || "";
	const businessid = req.body.businessid || "";
	
	const userdetail = await getUser(uniqid);

	if (!userdetail.status) return res.send({
		status: false,
		response: "Böyle bir kullanıcı bulunamadı."
	});
	if (!userdetail.package) return res.send({
		status: false,
		response: "İlk önce bir paket satın almalısınız."
	});
	const cb = await counttweet(userdetail.userid , businessid);
	if (!cb.status) return res.send({
		status: false,
		response: "Böyle bir kayıt bulunamadı."
	});

	const ig = new IgApiClient();
	await ig.state.generateDevice(userdetail.iusername);
	try {
		await ig.account.login(userdetail.iusername, userdetail.ipassword);
    } catch (error) {
		return res.send({
			status: false,
			response: error.message
		});
	}

	const links = await getMediaLinks(content);
	const postitems = await postToInstagram(links);

	if(links.length <= 1){
		if(postitems[0]['type'] == "photo"){
			console.log('Foto seçildi');
			try {

				const insta = await ig.publish.photo({
					file: postitems[0]['file'],
					caption: sanitizeContent(content)
				});
				
				return res.send({
					status: true,
					response: "Yazı instagrama gönderildi."
				});
			} catch (error) {
				return res.send({
					status: false,
					response: error.message
				});
			}
		}else{
			console.log('Video seçildi');
			try {
				if(!postitems[1]){
					return res.send({
						status: false,
						response: "İlk video eklemeli daha sonra video için bir thumbnail eklemelisiniz."
					});
				}else{
					if(!postitems[1]['type'] != "photo"){
						return res.send({
							status: false,
							response: "İkinci eklenen ek fotoğraf olmalı ki videonun thumbnaili seçilebilsin."
						});
					}
				}
				const newimage = sharp(postitems[1]['file']);
				await newimage.resize({
					width: 1080,
					height: 1350,
					fit: sharp.fit.cover,
					position: sharp.strategy.entropy
				}).jpeg({ quality: 100 });
				const buffer = await newimage.toBuffer();

				const insta = await ig.publish.video({
					video: postitems[0]['file'],
					caption: sanitizeContent(content),
					coverImage: buffer,
				});
				
				return res.send({
					status: true,
					response: "Yazı instagrama gönderildi."
				});
			} catch (error) {
			  console.error(error);
			  return res.send({
				status: false,
				response: error.message
			  });
			}
		}
		
	}else{
		console.log('Albüm seçildi');
		if(postitems[1]['type'] == "photo" && postitems[0]['type'] != "video"){
			try {

				const albumOptions = {
					caption: sanitizeContent(content),
					items: postitems
				};
				const result = await ig.publish.album(albumOptions);
				return res.send({
					status: true,
					response: "Yazı instagrama gönderildi."
				});
			} catch (error) {
				return res.send({
					status: false,
					response: error.message
				});
			}
		}else{
			console.log('Video seçildi');
			try {
				if(!postitems[1]){
					return res.send({
						status: false,
						response: "İlk video eklemeli daha sonra video için bir thumbnail eklemelisiniz."
					});
				}else{
					if(postitems[1]['type'] != "photo"){
						return res.send({
							status: false,
							response: "İkinci eklenen ek fotoğraf olmalı ki videonun thumbnaili seçilebilsin."
						});
					}
				}
				const newimage = sharp(postitems[1]['file']);
				await newimage.resize({
					width: 1080,
					height: 1350,
					fit: sharp.fit.cover,
					position: sharp.strategy.entropy
				}).jpeg({ quality: 100 });
				const buffer = await newimage.toBuffer();

				const insta = await ig.publish.video({
					video: postitems[0]['file'],
					caption: sanitizeContent(content),
					coverImage: buffer,
				});
				
				return res.send({
					status: true,
					response: "Yazı instagrama gönderildi."
				});
			} catch (error) {
			  console.error(error);
			  return res.send({
				status: false,
				response: error.message
			  });
			}
		}

	}



});
app.post('/postmyinstagram', upload.none(), async (req, res) => {
	const uniqid = req.body.uniqid;
	const content = req.body.content || "";
	const businessid = req.body.businessid || "";

	
	const userdetail = await getUser(uniqid);

	if (!userdetail.status) return res.send({
		status: false,
		response: "Böyle bir kullanıcı bulunamadı."
	});
	if (!userdetail.package) return res.send({
		status: false,
		response: "İlk önce bir paket satın almalısınız."
	});
	const cb = await countbusiness(userdetail.userid , businessid);
	if (!cb.status) return res.send({
		status: false,
		response: "Böyle bir kayıt bulunamadı."
	});
	const imageData = await readImage(JSON.parse(cb.data[0]['imgpath'])[0]);
	const newimage = sharp(JSON.parse(cb.data[0]['imgpath'])[0]);
			if(JSON.parse(cb.data[0]['imgpath'])[0] == ""){
				if (!cb.status) return res.send({
					status: false,
					response: "İşletme görseli olmadığı için yazı gönderilemedi."
				});
			}
	await newimage.resize({
		width: 1080,
		height: 1350,
		fit: sharp.fit.cover,
		position: sharp.strategy.entropy
	}).jpeg({ quality: 100 });
	
	const buffer = await newimage.toBuffer();
	const ig = new IgApiClient();
	await ig.state.generateDevice(userdetail.iusername);
	try {
		await ig.account.login(userdetail.iusername, userdetail.ipassword);
    } catch (error) {
		return res.send({
			status: false,
			response: error.message
		});
	}
	try {

		const insta = await ig.publish.photo({
			file: buffer,
			caption: sanitizeContent(content)
		});
		console.log(insta);
		return res.send({
			status: true,
			response: "Yazı instagrama gönderildi."
		});
	} catch (error) {
		return res.send({
			status: false,
			response: error.message
		});
	}

});
app.post('/postmywordpress2', upload.none(), async (req, res) => {
	const uniqid = req.body.uniqid;
	const type = req.body.type || "wordpress";
	const selectedSite = req.body.selectedSite || "";
	const postbasifoto = req.body.postbasifoto || 1;
	const onecikarilangorsel = req.body.onecikarilangorsel || 1;
	let postfoto = '';
	let postbasifotog = '';
	
	const userdetail = await getUser(uniqid);
	if (!userdetail.status) return res.send({
		status: false,
		response: "Böyle bir kullanıcı bulunamadı."
	});
	if (!userdetail.package) return res.send({
		status: false,
		response: "İlk önce bir paket satın almalısınız."
	});
	let sitedetail = await checksite(selectedSite, userdetail.userid);
	if (!sitedetail.status) return res.send({
		status: false,
		response: "Böyle bir site bulunamadı!"
	});
	if(type == ""){
		return res.send({
		status: false,
		response: "Type null olamaz."
		});
	}else{
		if(type == "wordpress"){
			const terim = req.body.terim || "";
			const content = req.body.content || "";
			const category = req.body.category || "Uncategorized";
			const title = cheerio.load(content);
			const h1Text = title('h1').first().text() || " ";
			const businessid = req.body.businessid || "";

			const cb = await countbusiness(userdetail.userid , businessid);
			if (!cb.status) return res.send({
				status: false,
				response: "Böyle bir kayıt bulunamadı."
			});
			
			const clientOptions = {
			  host: sitedetail.data[0]['url'],
			  path: '/xmlrpc.php',
			  port: 80
			};
			
			const client = xmlrpc.createClient(clientOptions);
			let imguzanti = JSON.parse(cb.data[0]['imgpath'])[0];
			if (!imguzanti) {
				return;
			}
			const lastIndex = await imguzanti.lastIndexOf('/');
			const fileName = await imguzanti.slice(lastIndex + 1);
			const imageData = await readImage(imguzanti);
			client.methodCall('wp.uploadFile', [
			  0,
			  sitedetail.data[0]['username'],
			  sitedetail.data[0]['password'],
			  {
				name: fileName,
				type: 'image/jpg',
				bits: imageData,
				overwrite: true
			  }
			], function(error, file) {
			  if (error) {
					return res.send({
						status: false,
						response: error
					});
			  } else {
				if(postbasifoto == 1){
					postbasifotog = `<img src="${file.url}" alt="${file.name}">`;
				}
				if(onecikarilangorsel == 1){
					postfoto = file.id;
				}
				const newPostParams = [
					0,
					sitedetail.data[0]['username'],
					sitedetail.data[0]['password'],
					{
						post_title: h1Text,
						post_content: postbasifotog + content,
						terms_names: {
							category: [category],
							post_tag: [terim]
						},
						post_status: 'publish',
						post_thumbnail: postfoto
					}
				];

				client.methodCall('wp.newPost', newPostParams, function(error, postID) {
				  if (error) {
					return res.send({
						status: false,
						response: error
					});
				  } else {
					return res.send({
						status: true,
						response: `Post oluşturuldu numarası: ${postID}`
					});
				  }
				});
			  }
			});
		}
	}

});
app.post('/postmywordpress', upload.none(), async (req, res) => {
	const uniqid = req.body.uniqid;
	const type = req.body.type || "wordpress";
	
	const userdetail = await getUser(uniqid);
	if (!userdetail.status) return res.send({
		status: false,
		response: "Böyle bir kullanıcı bulunamadı."
	});
	if (!userdetail.package) return res.send({
		status: false,
		response: "İlk önce bir paket satın almalısınız."
	});
	if(type == ""){
		return res.send({
		status: false,
		response: "Type null olamaz."
		});
	}else{
		if(type == "wordpress"){
			const terim = req.body.terim || "";
			const content = req.body.content || "";
			const category = req.body.category || "Uncategorized";
			const title = cheerio.load(content);
			const h1Text = title('h1').first().text();
			const businessid = req.body.businessid || "";

			const cb = await countbusiness(userdetail.userid , businessid);
			if (!cb.status) return res.send({
				status: false,
				response: "Böyle bir kayıt bulunamadı."
			});
			const clientOptions = {
			  host: userdetail.wpurl,
			  path: '/xmlrpc.php',
			  port: 80
			};

			const client = xmlrpc.createClient(clientOptions);
			if(JSON.parse(cb.data[0]['imgpath'])[0] == ""){
				if (!cb.status) return res.send({
					status: false,
					response: "İşletme görseli olmadığı için yazı gönderilemedi."
				});
			}
			const lastIndex = await JSON.parse(cb.data[0]['imgpath'])[0].lastIndexOf('/');
			const fileName = await JSON.parse(cb.data[0]['imgpath'])[0].slice(lastIndex + 1);

			const imageData = await readImage(JSON.parse(cb.data[0]['imgpath'])[0]);
			client.methodCall('wp.uploadFile', [
			  0,
			  userdetail.wpusername,
			  userdetail.wppassword,
			  {
				name: fileName,
				type: 'image/jpg',
				bits: imageData,
				overwrite: true
			  }
			], function(error, file) {
			  if (error) {
					return res.send({
						status: false,
						response: error
					});
			  } else {
				const newPostParams = [
				  0,
				  userdetail.wpusername,
				  userdetail.wppassword,
				  {
					post_title: h1Text,
					post_content: `<img src="${file.url}" alt="${file.name}">` + content ,
					terms_names: {
					  category: [category],
					  post_tag: [terim]
					},
					post_status: 'publish'
				  }
				];

				client.methodCall('wp.newPost', newPostParams, function(error, postID) {
				  if (error) {
					return res.send({
						status: false,
						response: error
					});
				  } else {
					return res.send({
						status: true,
						response: `Post oluşturuldu numarası: ${postID}`
					});
				  }
				});
			  }
			});
	
		}else if(type == "twitter"){
			const terim = req.body.terim || "";
			let content = req.body.content || "";
			const category = req.body.category || "Uncategorized";
			const businessid = req.body.businessid || "";
			const withimage = req.body.withimage || 0;
			const title = cheerio.load(content);
			const h1Text = title('h1').first().text();
			
			const cb = await counttweet(userdetail.userid , businessid);
			if (!cb.status) return res.send({
				status: false,
				response: "Böyle bir kayıt bulunamadı."
			});
			const cbattachments = JSON.parse(cb.data[0]['attachments']);
			
				const clientOptions = {
				  host: userdetail.wpurl,
				  path: '/xmlrpc.php',
				  port: 80
				};

				const client = xmlrpc.createClient(clientOptions);

					const newPostParams = [
					  0,
					  userdetail.wpusername,
					  userdetail.wppassword,
					  {
						post_title: h1Text,
						post_content: content,
						terms_names: {
						  category: [category],
						  post_tag: [terim.replace(/\?/g, '')]
						},
						post_status: 'publish'
					  }
					];

					client.methodCall('wp.newPost', newPostParams, function(error, postID) {
					  if (error) {
						return res.send({
							status: false,
							response: error
						});
					  } else {
						return res.send({
							status: true,
							response: `Post oluşturuldu numarası: ${postID}`
						});
					  }
					});
		}
	}

});

app.post('/tweetcreatearticle', upload.none(), async (req, res) => {
	const gscrappertextarea = req.body.gscrappertextarea;
	const uniqid = req.body.uniqid;
	const tweetid = Number(req.body.tweetid);
	const nowtime = moment().format('YYYY-MM-DD HH:mm:ss');
	if(uniqid == ""){
		return res.send({
		status: false,
		response: "Uniqid null olamaz."
		});
	}
	if(tweetid == ""){
		return res.send({
		status: false,
		response: "tweetid null olamaz."
		});
	}
	if(gscrappertextarea == ""){
		return res.send({
			status: false,
			response: "Prompt null olamaz."
		});
	}
	const userdetail = await getUser(uniqid);
	if (!userdetail.status) return res.send({
		status: false,
		response: "Böyle bir kullanıcı bulunamadı."
	});
	if (!userdetail.package) return res.send({
		status: false,
		response: "İlk önce bir paket satın almalısınız."
	});
	const cb = await counttweet(userdetail.userid , tweetid);
	if (!cb.status) return res.send({
		status: false,
		response: "Böyle bir kayıt bulunamadı."
	});
	if(userdetail.gptrequest >= userdetail.maxgptrequest){
		if (!cb.status) return res.send({
			status: false,
			response: "Daha fazla GPT isteği göndermek için paketinizi yükseltmelisiniz."
		});
	}
	const regex = /\[(.*?)\]/g;
	const matches = [...gscrappertextarea.matchAll(regex)];
	if (matches.length === 0) {
		return res.send({
			status: false,
			response: "Veri olmadan içerik üretemezsiniz!"
		});
	}
	const replacements = {
	  author: cb.data[0]['author'],
	  tweet: cb.data[0]['tweet'],
	  title: cb.data[0]['title'],
	  link: cb.data[0]['link'],
	  tweetdate: cb.data[0]['tweetdate'],
	};
	const regex2 = /\[(.*?)\]/g;
	const result = gscrappertextarea.replace(regex2, (match, p1) => replacements[p1]+' ');
	try {

		const resp = await axios.post('https://api.openai.com/v1/chat/completions', {
		  model: 'gpt-3.5-turbo',
		  messages: [{ role: 'user', content: result }],
		  temperature: 0.6,
		  // top_p: 1
		}, {
		  headers: {
			'Content-Type': 'application/json',
			'Authorization': 'Bearer ' + userdetail.gptapi,
		  }
		})
		if (resp.data.choices[0]['message']['content']) {
			var islem = userdetail.gptrequest + 1;
			const query = 'UPDATE users SET gptrequest=? WHERE id=?';
			const values = [islem,userdetail.userid];
			try {
				const results = await queryAsync(query, values);
			} catch (e) {
			}
				const queryinsert = 'INSERT INTO makaleler SET content=?,owner=?,hedeftarama=?,hedeftaramatype=?,datetime=?';
				const valuesinsert = [resp.data.choices[0]['message']['content'],userdetail.userid,tweetid,"2",nowtime];
				try {
				const results = await queryAsync(queryinsert, valuesinsert);
				} catch (e) {
				}
			return res.send({
				status: true,
				response: resp.data.choices[0]['message']['content']
			});
		}else{
			return res.send({
				status: false,
				response: "ChatGPT error! "+e.message
			});
		}
	} catch (e) {
			return res.send({
				status: false,
				response: "ChatGPT error! "+e.message
			});
    }

});
app.post('/seciliolandanuret', upload.none(), async (req, res) => {
    const seciliolanlar = req.body.seciliolanlar;
    const websitesi = req.body.websitesi;
    const onecikarilangorsel = req.body.onecikarilangorsel;
    const beklemesuresi = req.body.beklemesuresi;
    const yorumsayisi = req.body.yorumsayisi || 0;
    const uniqid = req.body.uniqid;
    const nowtime = moment().format('YYYY-MM-DD HH:mm:ss');
	const gscrappertextarea = req.body.gscrappertextarea;
	const kategori = req.body.kategori || "Uncategorized";
	const postbasifoto = req.body.postbasifoto;
	let sitedetail;
	
    if (uniqid == "") {
        return res.send({
            status: false,
            response: "Uniqid null olamaz."
        });
    }
    const userdetail = await getUser(uniqid);
    if (!userdetail.status) return res.send({
        status: false,
        response: "Böyle bir kullanıcı bulunamadı."
    });
    if (websitesi != "0") {
        sitedetail = await checksite(websitesi, userdetail.userid);
        if (!sitedetail.status) return res.send({
            status: false,
            response: "Böyle bir site bulunamadı!"
        });
    }
	console.log(sitedetail);
	// return;
	
	const regex = /\[(.*?)\]/g;
	const matches = [...gscrappertextarea.matchAll(regex)];
	if (matches.length === 0) {
		return res.send({
			status: false,
			response: "Veri olmadan içerik üretemezsiniz!"
		});
	}
	
	const seciliolanlarArray = seciliolanlar.split(',');
	const promises = [];
	const startpromise = Date.now();
	for (const item of seciliolanlarArray) {
		const promise = new Promise(async (resolve, reject) => {
			let replacemetin;
			let harfsayisi;
			let kelimesayisi;
			let postids;
			let postbasifotog = '';
			let postfoto;
			let h1Text;
			try {
				const dbsonuc = await queryAsync('SELECT * FROM isletmeler WHERE id=? AND owner=?', [item, userdetail.userid]);
				if (dbsonuc.length > 0) {
					const replacements = {
						name: dbsonuc[0].name,
						phone: dbsonuc[0].phone,
						url: dbsonuc[0].url,
						adres: dbsonuc[0].adres,
						calismasaatleri: dbsonuc[0].calismasaatleri,
						imgpath: JSON.parse(dbsonuc[0].imgpath)[0],
						rating: dbsonuc[0].rating,
						ratingcategory: dbsonuc[0].ratingcategory,
						reviews: dbsonuc[0].reviews,
						yorumlar: dbsonuc[0].yorumlar,
						terim: dbsonuc[0].terim,
						scandatetime: dbsonuc[0].datetime
					};
					const regex2 = /\[(.*?)\]/g;
					const contentresult = gscrappertextarea.replace(regex2, (match, p1) => replacements[p1]+' ');
					
					try {
						console.log('chatgptgiriyor');
						const start = Date.now();
						const resp = await axios.post('https://api.openai.com/v1/chat/completions', {
						  model: 'gpt-3.5-turbo',
						  messages: [{ role: 'user', content: contentresult }],
						  temperature: 0.6,
						  // top_p: 1
						}, {
						  headers: {
							'Content-Type': 'application/json',
							'Authorization': 'Bearer ' + userdetail.gptapi,
						  }
						})
						if (resp.data.choices[0]['message']['content']) {
							let chatgptciktisi = resp.data.choices[0]['message']['content'];
							kelimesayisi = chatgptciktisi.replace(/\n/g, '<br>').split(' ').length;
							harfsayisi = chatgptciktisi.replace(/\n/g, '<br>').length;
							
							try{
								var islem = userdetail.gptrequest + 1;
								const query = 'UPDATE users SET gptrequest=? WHERE id=?';
								const values = [islem,userdetail.userid];
								const results = await queryAsync(query, values);
							}catch(e){console.log("Bir hata oluştu 1: " + e);}
							
							try {
								const queryinserta = 'INSERT INTO makaleler SET content=?,owner=?,hedeftarama=?,hedeftaramatype=?,datetime=?,uretilenisletmetitle=?,uretilenisletmearamakeyword=?,kelimesayisi=?,harfsayisi=?';
								const valuesnew = [chatgptciktisi,userdetail.userid,item,"1",nowtime,dbsonuc[0].name,dbsonuc[0].terim,kelimesayisi,harfsayisi];
								const results = await queryAsync(queryinserta, valuesnew);
							} catch(e){console.log("Bir hata oluştu: 2" + e);}
							
									if (websitesi != "0") {
										try{
											const clientOptions = {
												host: sitedetail.data[0]['url'],
												path: '/xmlrpc.php',
												port: 80
											};

											const client = xmlrpc.createClient(clientOptions);

											
											let title = cheerio.load(chatgptciktisi);
											h1Text = title('h1').first().text() || " ";
											if(h1Text == ""){
												h1Text = title('h2').first().text() || " ";
											}
											let imguzanti = JSON.parse(dbsonuc[0].imgpath)[0];
											if (!imguzanti) {
												resolve('İşletme görseli olmadığı için yazı postalanamadı. ' + dbsonuc[0].name);
												return;
											}
											const lastIndex = await imguzanti.lastIndexOf('/');
											const fileName = await imguzanti.slice(lastIndex + 1);
											
											const imageData = await readImage(imguzanti);
											client.methodCall('wp.uploadFile', [
												0,
												sitedetail.data[0]['username'],
												sitedetail.data[0]['password'],
												{
													name: fileName,
													type: 'image/jpg',
													bits: imageData,
													overwrite: true
												}
											], function(error, file) {
												if (error) {
													resolve("Bir hata oluştu: 3" + error);
													return;
												} else {
													if(postbasifoto == 1){
														postbasifotog = `<img src="${file.url}" alt="${file.name}">`;
													}
													if(onecikarilangorsel == 1){
														postfoto = file.id;
													}
													const newPostParams = [
														0,
														sitedetail.data[0]['username'],
														sitedetail.data[0]['password'],
														{
															post_title: h1Text,
															post_content: postbasifotog + chatgptciktisi,
															terms_names: {
																category: [kategori],
																post_tag: [dbsonuc[0].terim]
															},
															post_status: 'publish',
															post_thumbnail: postfoto
														}
													];

													client.methodCall('wp.newPost', newPostParams, function(error, postID) {
													  if (error) {
														reject("Bir hata oluştu: 4" + error);
													  } else {
														console.log("Yeni yayın başarıyla oluşturuldu ve ID'si: " + postID);
													  }
													});

												}
												const end = Date.now();
												const timeTakenInSeconds = (end - start) / 1000;
												const timeTakenInMinutes = Math.floor(timeTakenInSeconds / 60);
												const timeTakenInSecondsRemainder = Math.round(timeTakenInSeconds % 60);
												resolve(`Makale üretimi başarılı. ${h1Text}. Harcanan süre: <b>${timeTakenInMinutes} dakika ${timeTakenInSecondsRemainder} saniye</b><br><hr>`);
											});
										}catch(e){reject("Bir hata oluştu: 5" + e);return;}
									}else{
										h1Text = dbsonuc[0].name;
										const end = Date.now();
										const timeTakenInSeconds = (end - start) / 1000;
										const timeTakenInMinutes = Math.floor(timeTakenInSeconds / 60);
										const timeTakenInSecondsRemainder = Math.round(timeTakenInSeconds % 60);
										resolve(`Makale üretimi başarılı. ${h1Text}. Harcanan süre: <b>${timeTakenInMinutes} dakika ${timeTakenInSecondsRemainder} saniye</b><br><hr>`);
									}
								}else{
									resolve("CHATGPT postu oluşturulamadı.");
								}
					} catch (e) {resolve("Bir hata oluştu: 6" + e);return;}
				}
			} catch (e) {resolve("Bir hata oluştu: 7" + e);return;}

		});
		promises.push(promise);
	}
	Promise.all(promises)
	.then(results => {
		const lastresponse = results.join("");
		const stoppromise = Date.now();
		const timeTakenInSecondss = (stoppromise - startpromise) / 1000;
		const timeTakenInMinutess = Math.floor(timeTakenInSecondss / 60);
		const timeTakenInSecondsRemainderr = Math.round(timeTakenInSecondss % 60);
		res.send({status: true, response: lastresponse+ `Toplam Harcanan süre: <b>${timeTakenInMinutess} dakika ${timeTakenInSecondsRemainderr} saniye</b>`});
		
	})
	.catch(error => {
		const errorResponse = "Bir hata oluştu: " + error;
		res.send({status: false, response: errorResponse});  
	});

});

app.post('/scrappercreatearticle', upload.none(), async (req, res) => {
	const gscrappertextarea = req.body.gscrappertextarea;
	const uniqid = req.body.uniqid;
	const businessid = Number(req.body.businessid) || "";
	const nowtime = moment().format('YYYY-MM-DD HH:mm:ss');
	if(uniqid == ""){
		return res.send({
		status: false,
		response: "Uniqid null olamaz."
		});
	}
	if(businessid == ""){
		return res.send({
		status: false,
		response: "Businessid null olamaz."
		});
	}
	if(gscrappertextarea == ""){
		return res.send({
			status: false,
			response: "Prompt null olamaz."
		});
	}
	const userdetail = await getUser(uniqid);
	if (!userdetail.status) return res.send({
		status: false,
		response: "Böyle bir kullanıcı bulunamadı."
	});
	if (!userdetail.package) return res.send({
		status: false,
		response: "İlk önce bir paket satın almalısınız."
	});
	if (userdetail.package == 1) return res.send({
		status: false,
		response: "Paketiniz içerik üretmek için uygun değil."
	});
	const cb = await countbusiness(userdetail.userid , businessid);
	if (!cb.status) return res.send({
		status: false,
		response: "Böyle bir kayıt bulunamadı."
	});
	if(userdetail.gptrequest >= userdetail.maxgptrequest){
		return res.send({
			status: false,
			response: "Daha fazla GPT isteği göndermek için paketinizi yükseltmelisiniz."
		});
	}
	const regex = /\[(.*?)\]/g;
	const matches = [...gscrappertextarea.matchAll(regex)];
	if (matches.length === 0) {
		return res.send({
			status: false,
			response: "Veri olmadan içerik üretemezsiniz!"
		});
	}

	const replacements = {
		name: cb.data[0]['name'],
		phone: cb.data[0]['phone'],
		url: cb.data[0]['url'],
		adres: cb.data[0]['adres'],
		calismasaatleri: cb.data[0]['calismasaatleri'],
		imgpath: JSON.parse(cb.data[0]['imgpath'])[0],
		rating: cb.data[0]['rating'],
		ratingcategory: cb.data[0]['ratingcategory'],
		reviews: cb.data[0]['reviews'],
		yorumlar: cb.data[0]['yorumlar'],
		terim: cb.data[0]['terim'],
		scandatetime: cb.data[0]['datetime']
	};
	const regex2 = /\[(.*?)\]/g;
	const result = gscrappertextarea.replace(regex2, (match, p1) => replacements[p1]+' ');
	try {
		const resp = await axios.post('https://api.openai.com/v1/chat/completions', {
		  model: 'gpt-3.5-turbo',
		  messages: [{ role: 'user', content: result }],
		  temperature: 0.6,
		  // top_p: 1
		}, {
		  headers: {
			'Content-Type': 'application/json',
			'Authorization': 'Bearer ' + userdetail.gptapi,
		  }
		})
		if (resp.data.choices[0]['message']['content']) {
			var islem = userdetail.gptrequest + 1;
			const query = 'UPDATE users SET gptrequest=? WHERE id=?';
			const values = [islem,userdetail.userid];
			try {
				const results = await queryAsync(query, values);
			} catch (e) {
			}
			try {
				const queryinserta = 'INSERT INTO makaleler SET content=?,owner=?,hedeftarama=?,hedeftaramatype=?,datetime=?';
				const valuesnew = [resp.data.choices[0]['message']['content'],userdetail.userid,businessid,"1",nowtime];
				try {
				const results = await queryAsync(queryinserta, valuesnew);
				} catch (e) {
					console.log(e);
				}
			} catch (e) {
			}
			return res.send({
				status: true,
				response: resp.data.choices[0]['message']['content']
			});

		}else{
			return res.send({
				status: false,
				response: "ChatGPT error! "+e.message
			});
		}
	} catch (e) {
		return res.send({
			status: false,
			response: "ChatGPT error! "+e.message
		});
    }

});
app.post('/gettweet', upload.none(), async (req, res) => {
	const username = req.body.username;
	const uniqid = req.body.uniqid;
	let taramaid = generateUniqueId();
	const nowtime = moment().format('YYYY-MM-DD HH:mm:ss');
	const type = req.body.type || 0;
	
	if(uniqid == ""){
		return res.send({
		status: false,
		response: "Uniqid null olamaz."
		});
	}

	const userdetail = await getUser(uniqid);
	if (!userdetail.status) return res.send({
		status: false,
		response: "Böyle bir kullanıcı bulunamadı."
	});
	if (!userdetail.package) return res.send({
		status: false,
		response: "İlk önce bir paket satın almalısınız."
	});
	const gettweetdata = await getTweets(username,type);
	if(!gettweetdata){
		return res.send({
		status: false,
		response: "Tweet çekim işlemi başarısız."
		});
	}
	try {
		const query = 'INSERT INTO tscrappers SET tscrapeid=?,account=?,owner=?,count=?,datetime=?';
		const values = [taramaid,username,userdetail.userid,gettweetdata.length,nowtime];
		try {
		const results = await queryAsync(query, values);
		} catch (e) {
		}
	} catch (e) {
	}
	for (const item of gettweetdata) {
		const mp4Links = item.content.match(/(http(s)?:\/\/)?([w]{3}\.)?[^"'\s]*\.mp4/gi);
		const jpgLinks = item.content.match(/(http(s)?:\/\/)?([w]{3}\.)?[^"'\s]*\.jpg/gi);
		const specialLinks = item.content.match(/(http(s)?:\/\/)?([w]{3}\.)?[^"'\s]*\jpg/gi);

		const linksArray = [];

		if (mp4Links) {
		  mp4Links.forEach(link => {
			linksArray.push(link.replace(/'/g, "\\'"));
		  });
		}

		if (jpgLinks) {
		  jpgLinks.forEach(link => {
			linksArray.push(link.replace(/'/g, "\\'"));
		  });
		}
		
		if (specialLinks) {
		  specialLinks.forEach(link => {
			linksArray.push(link.replace(/'/g, "\\'"));
		  });
		}
		
	  try {
		const query = 'INSERT INTO tweetler SET owner=?,tweet=?,author=?,scrapperid=?,title=?,link=?,tweetdate=?,attachments=?';
		const values = [userdetail.userid,item.content,item.author,taramaid,item.title,item.link,item.pubDate,JSON.stringify(linksArray)];
		const results = await queryAsync(query, values);
	  } catch (e) {
		console.error(e);
	  }
	}
	return res.send({status: true, response: "İşlem başarılı.",redirect:true,location:"tweetscrapper",time:3000});
});
app.post('/startgscrape2', upload.none(), async (req, res) => {
	
	const terim = req.body.aranacakdeger || "Türkiye'de dükkanlar";
	const width = req.body.width || 800;
	const height = req.body.height || 600;
	const timeout = req.body.timeout || 6000;
	const uniqid = req.body.uniqid;
	const onlyphone = req.body.onlyphone || 0;
	const yorumcek = req.body.yorumcek || 0;
	const yorumlimiti = req.body.yorumlimiti || 3;
	const yorumdongusu = req.body.yorumdongusu || 1;

	let maxveri;
	
	if(uniqid == ""){
		return res.send({
		status: false,
		response: "Uniqid null olamaz."
		});
	}
	
	if(timeout > 20000){
		return res.send({
		status: false,
		response: "Timeout maksimum 20000 olabilir."
		});
	}
	
	if(width > 1680 || height > 1050 || height < 50 || width < 50){
		return res.send({
		status: false,
		response: "Image boyutları maksimum 1680x1050, minimum 50x50 olabilir."
		});
	}
	
	const userdetail = await getUser(uniqid);

	if (!userdetail.status) return res.send({
		status: false,
		response: "Böyle bir kullanıcı bulunamadı."
	});
	if (!userdetail.package) return res.send({
		status: false,
		response: "İlk önce bir paket satın almalısınız."
	});
	const scanner = await countscan(userdetail.userid,userdetail.taramasayisi);
	if (!scanner.status) return res.send({
		status: false,
		response: "Aynı anda maksimum "+userdetail.taramasayisi+" tarama yapabilirsiniz."
	});
	if(userdetail.package == 1){
		maxveri = 50;
	}else if(userdetail.package == 2){
		maxveri = 120;
	}else if(userdetail.package == 3){
		maxveri = 9999;
	}

		const calistir = spawn('node', ['./newgooglescraper.js', '--terim', terim, '--fotow', width, '--fotoh', height, '--userid', userdetail.userid, '--timeout', timeout, '--taramasayisi', userdetail.taramasayisi,'--onlyphone',onlyphone,'--maxveri',maxveri,'--yorumcek',yorumcek,'--yorumlimiti',yorumlimiti,'--yorumdongusu',yorumdongusu]);

		if (calistir) {
			return res.send({status: true, response: "Hizmet başlatma isteğiniz sıraya alındı... Kısa süre içerisinde ekranınıza düşecektir.",redirect:true,location:"gscrapper",time:3000,processid: calistir.pid});
		} else {
			return res.send({status: false, response: "Hizmet başlatılamadı."});
		}
});

app.post('/createarticle', upload.none(), async (req, res) => {
	const uniqid = req.body.uniqid;
	const anahtarkelime = req.body.anahtarkelime;
	const paragrafkelimesayisi = req.body.paragrafkelimesayisi;
	const basliksayisi = req.body.basliksayisi;
	const language = req.body.language;
	const uretimadedi = req.body.uretimadedi;
	
	const userdetail = await getUser(uniqid);
	let anabasliklar = [];
	let content = null;
	let totalcontent = "";
	
	if (!userdetail.status) return res.send({
		status: false,
		response: "Böyle bir kullanıcı bulunamadı."
	});
	if (!userdetail.package) return res.send({
		status: false,
		response: "İlk önce bir paket satın almalısınız."
	});
	const start = Date.now();
	for (let articleIndex = 0; articleIndex < uretimadedi; articleIndex++) {
		let articledetails = "";
		const filename = `article_${generateRandomNumber()}.htm`;
		let articleContent = '';
		try{
			let sorgu1 = `Sana göndereceğim JSON şemasına göre JSON veri oluştur. Sadece JSON veri gönder başka birşey söyleme.
				{
					"prompt": "Size vereceğim anahtar kelime ile ilgili SEO ve Semantik web kurallarına uygun birbirinden tamamen farklı toplamda '${basliksayisi}' adet ${language} başlık üretin. Anahtar kelime başlıkların içinde geçmeli. Her bir başlık tamamen benzersiz olmalıdır. Anahtar kelime: ${anahtarkelime}",
					"limit": "${basliksayisi}",
					"data": {
						"title": {
							"type": "string"
						},
						"headtype": {
							"type": "string",
							"class: "strong"
						}
					}
				}
				Sonuçları kesinlikle aşağıdaki formatta döndür:
				{
					"results": [
						  { title: 'Sample Title', headtype: 'Sample Headtype' },...
					]
				}
				`;

			
				const resp = await axios.post('https://api.openai.com/v1/chat/completions', {
					model: 'gpt-3.5-turbo',
					messages: [{
						role: 'user',
						content: sorgu1
					}],
					temperature: randomBetweenZeroAndHalf,
					top_p: randomBetweenZeroAndHalf
				}, {
					headers: {
						'Content-Type': 'application/json',
						'Authorization': 'Bearer ' + userdetail.gptapi,
					}
				})
				
				if (resp.data.choices[0]['message']['content']) {
					anabasliklar = JSON.parse(resp.data.choices[0]['message']['content'])['results'];
				}
				console.log(anabasliklar);
				try{
					let table = '<table id="seo-friendly-table">\n<thead>\n<tr>\n<th scope="col">Sıra</th>\n<th scope="col">Başlık</th>\n</tr>\n</thead>\n<tbody>\n';
					for (let i = 0; i < anabasliklar.length; i++) {
						var baslik = anabasliklar[i]['title'];
						var seolubaslikd = await seo(baslik);
						table += "<tr>\n<td scope='row'>" + (i + 1) + "</td>\n<td><a href=#"+seolubaslikd+">" + anabasliklar[i]['title']; + "</a></td>\n</tr>\n";
					}
					table += "</tbody>\n</table>";
					totalcontent += table;
					articledetails += table;
				}catch(e){
					console.log(e);
				}
				if (anabasliklar) {
					for (let i = 0; i < anabasliklar.length; i++) {
						var baslik = anabasliklar[i]['title'];
						var basliktype = anabasliklar[i]['headtype'];
						var seolubaslik = await seo(baslik);
						
						totalcontent += '<a href="#'+seolubaslik+'"><'+basliktype+'>'+baslik+'</'+basliktype+'></a><br>';
						let sorgu2 = `Now I want you to take on the role of a human article master and let your writing style be like a human. Write a paragraph about the title "${baslik}" in the ${language} language only, the ${paragrafkelimesayisi} of which is below the word. Start your paragraph with a quick introduction to the topic and avoid praise or repetitive information. Also, use keywords in <strong></strong> tags to comply with SEO rules. If you want to add external links, click the links "<a href='https://tr.wikipedia.org/wiki/${baslik}'>${baslik}</a>" or if the keyword is a product ""<a href='https://www.trendyol.com/sr?q=${baslik}'>${baslik}</a>" ".."`;
						// console.log(sorgu2);
						const resp = await axios.post('https://api.openai.com/v1/chat/completions', {
							model: 'gpt-3.5-turbo',
							messages: [{
								role: 'user',
								content: sorgu2
							}],
							temperature: randomBetweenZeroAndHalf,
							top_p: randomBetweenZeroAndHalf
						}, {
							headers: {
								'Content-Type': 'application/json',
								'Authorization': 'Bearer ' + userdetail.gptapi,
							}
						})
						if (resp.data.choices[0]['message']['content']) {
							content = resp.data.choices[0]['message']['content'];
							totalcontent += content;
							articledetails += content;
							console.log(content);
						}
						
					}
				}
		  articleContent += `Keywords: ${anahtarkelime}\n\n`;
		  articleContent += `Language: ${language}\n\n`;
		  
		  // Save the article to a TXT file
		  fs.writeFileSync(filename, articledetails);

		}catch(e){
			return res.send({
				status: false,
				response: "ChatGPT Error!" + e
			});
		}}
		const end = Date.now();
		const timeTakenInSeconds = (end - start) / 1000;
		const timeTakenInMinutes = Math.floor(timeTakenInSeconds / 60);
		const timeTakenInSecondsRemainder = Math.round(timeTakenInSeconds % 60);
		return res.send({
			status: true,
			response: `Makale üretimi başarılı. Harcanan süre: <b>${timeTakenInMinutes} dakika ${timeTakenInSecondsRemainder} saniye</b>`,
			responsetext:totalcontent
		});

});

app.post('/startgscrape', upload.none(), async (req, res) => {
	
	const terim = req.body.aranacakdeger || "Türkiye'de dükkanlar";
	const width = req.body.width || 800;
	const height = req.body.height || 600;
	const timeout = req.body.timeout || 6000;
	const uniqid = req.body.uniqid;
	const onlyphone = req.body.onlyphone || 0;
	const dil = req.body.dil || "tr";
	
	if(uniqid == ""){
		return res.send({
		status: false,
		response: "Uniqid null olamaz."
		});
	}
	
	if(timeout > 20000){
		return res.send({
		status: false,
		response: "Timeout maksimum 20000 olabilir."
		});
	}
	
	if(width > 1680 || height > 1050 || height < 50 || width < 50){
		return res.send({
		status: false,
		response: "Image boyutları maksimum 1680x1050, minimum 50x50 olabilir."
		});
	}
	
	const userdetail = await getUser(uniqid);

	if (!userdetail.status) return res.send({
		status: false,
		response: "Böyle bir kullanıcı bulunamadı."
	});
	if (!userdetail.package) return res.send({
		status: false,
		response: "İlk önce bir paket satın almalısınız."
	});
	const scanner = await countscan(userdetail.userid,userdetail.taramasayisi);
	if (!scanner.status) return res.send({
		status: false,
		response: "Aynı anda maksimum "+userdetail.taramasayisi+" tarama yapabilirsiniz."
	});
	

	if(dil == "tr"){
		const calistir = spawn('node', ['./googlescraper.js', '--terim', terim, '--fotow', width, '--fotoh', height, '--userid', userdetail.userid, '--timeout', timeout, '--taramasayisi', userdetail.taramasayisi,'--onlyphone',onlyphone]);

		if (calistir) {
			return res.send({status: true, response: "Hizmet başlatma isteğiniz sıraya alındı. Kısa süre içerisinde ekranınıza düşecektir.",redirect:true,location:"gscrapper",time:3000,processid: calistir.pid});
		} else {
			return res.send({status: false, response: "Hizmet başlatılamadı."});
		}
	}else if(dil == "en"){
		const calistir = spawn('node', ['./googlescraperen.js', '--terim', terim, '--fotow', width, '--fotoh', height, '--userid', userdetail.userid, '--timeout', timeout, '--taramasayisi', userdetail.taramasayisi,'--onlyphone',onlyphone]);

		if (calistir) {
			return res.send({status: true, response: "Hizmet başlatma isteğiniz sıraya alındı. Kısa süre içerisinde ekranınıza düşecektir.",redirect:true,location:"gscrapper",time:3000,processid: calistir.pid});
		} else {
			return res.send({status: false, response: "Hizmet başlatılamadı."});
		}
	}else if(dil == "de"){
		const calistir = spawn('node', ['./googlescraperde.js', '--terim', terim, '--fotow', width, '--fotoh', height, '--userid', userdetail.userid, '--timeout', timeout, '--taramasayisi', userdetail.taramasayisi,'--onlyphone',onlyphone]);

		if (calistir) {
			return res.send({status: true, response: "Hizmet başlatma isteğiniz sıraya alındı. Kısa süre içerisinde ekranınıza düşecektir.",redirect:true,location:"gscrapper",time:3000,processid: calistir.pid});
		} else {
			return res.send({status: false, response: "Hizmet başlatılamadı."});
		}
	}else if(dil == "ru"){
		const calistir = spawn('node', ['./googlescraperru.js', '--terim', terim, '--fotow', width, '--fotoh', height, '--userid', userdetail.userid, '--timeout', timeout, '--taramasayisi', userdetail.taramasayisi,'--onlyphone',onlyphone]);

		if (calistir) {
			return res.send({status: true, response: "Hizmet başlatma isteğiniz sıraya alındı. Kısa süre içerisinde ekranınıza düşecektir.",redirect:true,location:"gscrapper",time:3000,processid: calistir.pid});
		} else {
			return res.send({status: false, response: "Hizmet başlatılamadı."});
		}
	}
});
function generateUniqueId() {
  const buffer = crypto.randomBytes(4);
  return buffer.toString('hex').substring(0, 8);
}
async function getUser(uniqid) {
    const response = {
        status: false
    };
    const query = 'SELECT * FROM users WHERE uniqid=?';

    try {
        const results = await queryAsync(query, [uniqid]);
        if (results.length > 0) {
			let freegptcode;
			let taramasayisi;
			let gptrequest;
			if(results[0]['package'] == 1){
				taramasayisi = 9999999999999999999;
				freegptcode = "";
				maxgptrequest = 99999999999999;
			}else if(results[0]['package'] == 2){
				taramasayisi = 999999999999999999999;
				freegptcode = "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";
				maxgptrequest = 9999999999999999999;
			}else if(results[0]['package'] == 3){
				taramasayisi = 9999999999999999999;
				freegptcode = "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";
				maxgptrequest = 99999999999999;
			}
            response.status = true;
            response.userid = results[0]['id'];
			response.gptapi = results[0]['gptapi'] || freegptcode;
			response.wpurl = results[0]['wpurl'];
			response.wpusername = results[0]['wpusername'];
			response.wppassword = results[0]['wppassword'];
			response.ipassword = results[0]['ipassword'];
			response.iusername = results[0]['iusername'];
			response.package = results[0]['package'];
			response.taramasayisi = taramasayisi;
			response.gptrequest = parseInt(results[0]['gptrequest']);
			response.maxgptrequest = parseInt(results[0]['maxgptrequest']);
			response.telegramid = results[0]['telegramid'];
			response.telegramapi = results[0]['telegramapi'];
        } else {
            response.hata = 'Kullanıcı bulunamadı.';
        }
    } catch (error) {
        console.error('DB Sorgu Hatası: ' + error.stack);
        throw new Error('Internal Server Error');
    }

    return response;
}
async function countscan(userid,taramasayisi) {
    const response = {
        status: false
    };
    const query = 'SELECT * FROM gscrappers WHERE owner=? AND status IN (0,1)';

    try {
        const results = await queryAsync(query, [userid]);
		console.log(results.length);
        if (results.length < taramasayisi) {
            response.status = true;
        }
    } catch (error) {
        console.error('DB Sorgu Hatası: ' + error.stack);
        throw new Error('Internal Server Error');
    }

    return response;
}
async function counttweet(userid,scanid) {
    const response = {
        status: false
    };
    const query = 'SELECT * FROM tweetler WHERE id=? AND owner=?';

    try {
        const results = await queryAsync(query, [scanid,userid]);
        if (results.length > 0) {
            response.status = true;
			response.data = results;
        } else {
            response.hata = 'Tweet bulunamadı.';
        }
    } catch (error) {
        console.error('DB Sorgu Hatası: ' + error.stack);
        throw new Error('Internal Server Error');
    }

    return response;
}
async function checksite(uniqid,owner) {
    const response = {
        status: false
    };
    const query = 'SELECT * FROM sites WHERE uniqid=? AND owner=?';

    try {
        const results = await queryAsync(query, [uniqid,owner]);
        if (results.length > 0) {
            response.status = true;
			response.data = results;
        } else {
            response.hata = 'Site bulunamadı.';
        }
    } catch (error) {
        console.error('DB Sorgu Hatası: ' + error.stack);
        throw new Error('Internal Server Error');
    }

    return response;
}
async function countsite(userid) {
    const response = {
        status: false
    };
    const query = 'SELECT * FROM sites WHERE owner=?';

    try {
        const results = await queryAsync(query, [userid]);
        if (results.length > 0) {
            response.status = true;
			response.data = results;
        } else {
            response.hata = 'Site bulunamadı.';
        }
    } catch (error) {
        console.error('DB Sorgu Hatası: ' + error.stack);
        throw new Error('Internal Server Error');
    }

    return response;
}
async function countbusiness(userid,scanid) {
    const response = {
        status: false
    };
    const query = 'SELECT * FROM isletmeler WHERE id=? AND owner=?';

    try {
        const results = await queryAsync(query, [scanid,userid]);
        if (results.length > 0) {
            response.status = true;
			response.data = results;
        } else {
            response.hata = 'İşletme bulunamadı.';
        }
    } catch (error) {
        console.error('DB Sorgu Hatası: ' + error.stack);
        throw new Error('Internal Server Error');
    }

    return response;
}
async function getTweets(username,type) {
	if(type == 0){
		try{
			const url = `https://rsshub.app/twitter/keyword/${username}`;
			const res = await fetch(url);
			const feed = await res.text();
			const data = await parser.parseString(feed);
			return data.items.slice(0, 33333);
		}catch(e){
			return false;
		}
	}else{
		try{
			const url = `https://rsshub.app/twitter/user/${username}`;
			const res = await fetch(url);
			const feed = await res.text();
			const data = await parser.parseString(feed);
			return data.items.slice(0, 33333);
		}catch(e){
			return false;
		}
	}
}
app.listen(3000, () => {
    console.log('Server listening on port 3000');
});