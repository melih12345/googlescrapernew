const {
    Builder,
    By,
    Key,
    until
} = require('selenium-webdriver');
const chrome = require('selenium-webdriver/firefox');
const argparse = require('argparse');
const axios = require("axios");
const path = require("path");
const fs = require('fs');
const mysql = require('mysql');
const util = require('util');
const crypto = require('crypto');
const moment = require('moment-timezone');
// const url = require('url');
// const querystring = require('querystring');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'db'
});

const queryAsync = util.promisify(connection.query).bind(connection);

const parser = new argparse.ArgumentParser({
    description: 'Scrape businesses from Google Maps'
});

parser.add_argument('--terim');
parser.add_argument('--fotow');
parser.add_argument('--fotoh');
parser.add_argument('--userid');
parser.add_argument('--timeout');
parser.add_argument('--taramasayisi');
parser.add_argument('--onlyphone');
parser.add_argument('--yorumdongusu');
parser.add_argument('--maxveri');
parser.add_argument('--yorumcek');
parser.add_argument('--yorumlimiti');

const args = parser.parse_args();

const terim = args.terim || "izmir yemek";
const fotow = args.fotow || 800;
const fotoh = args.fotoh || 600;
const userid = args.userid || 1;
const timeout = args.timeout || 6000;
const taramasayisi = args.taramasayisi || 2232;
const onlyphone = args.onlyphone || 0;
let yorumdongusu = args.yorumdongusu | 1;
const maxveri = args.maxveri || 50;
const yorumcek = args.yorumcek || 1;
const yorumlimiti = args.yorumlimiti || 3;

let taramaid = generateUniqueId();
let sayfasayisi = 1;

console.log(`Arama başlıyor: ${terim} `);

function generateUniqueId() {
    const buffer = crypto.randomBytes(4);
    return buffer.toString('hex').substring(0, 8);
}
(async function scrapeGoogleMaps() {
	
    const nowtime = moment().format('YYYY-MM-DD HH:mm:ss');
    const options = new chrome.Options();
	// options.addArguments("--disable-gpu");
	// options.addArguments("--no-sandbox");
    const driver = await new Builder()
        .forBrowser("chrome")
        .setChromeOptions(options)
        .build();
	
    const query = 'SELECT * FROM gscrappers WHERE owner=? AND status IN (0,1)';

    try {
        const results = await queryAsync(query, [userid]);
		console.log(results.length);
        if (results.length < taramasayisi) {
        }else{
			await driver.quit();
			await process.exit();
		}
    } catch (error) {
        console.error('DB Sorgu Hatası: ' + error.stack);
        throw new Error('Internal Server Error');
    }
	
	try{
		await driver.get('https://www.google.com/search?q=' + terim + '&rlz=3&cs=0&tbm=lcl&start=0');
		await driver.sleep(2000);
		
		try{
			const tableElement = await driver.findElement(By.css('table[role="presentation"]'));
			let sayfa = await tableElement.findElements(By.css("td"));
			sayfasayisi = sayfa.length;
		}catch(e){console.log(e);}
		
		if(sayfasayisi == undefined || sayfasayisi == "" || sayfasayisi == null){
			sayfasayisi = 1;
		}

		try {
			const query = 'INSERT INTO gscrappers SET gscrapeid=?,scrapename=?,owner=?,status=?,action=?,datetime=?';
			const values = [taramaid,terim,userid,1,"Tarama:: İşlemler başladı.",nowtime];
			try {
				const results = await queryAsync(query, values);
			} catch (e) {}
		} catch (e) {}
		
		try {
			for (let i = 0; i < sayfasayisi; i++) {
			
				const pageindex = i * 20;
				await driver.get('https://www.google.com/search?q=' + terim + '&rlz=3&cs=0&tbm=lcl&start='+pageindex);
				
				try {
					const businesses = await driver.wait(
						until.elementsLocated(By.className('cXedhc')),
						20000
					);
				}catch(e){
					const query = 'UPDATE gscrappers SET action=?,status=?,datetime=? WHERE gscrapeid=?';
					const values = ["Tarama:: Tarama sonuçlandırıldı 2.",2,nowtime,taramaid];
					try {
						const results = await queryAsync(query, values);
					} catch (e) {
					}
					await driver.quit();
					await process.exit();
				}

				let output = [];
				while (true) {
					try {
						const detailsElements = await driver.wait(until.elementsLocated(By.className('rllt__details')), 10000);
						
						for (const detailsElement of detailsElements) {
							let name = '';
							let telefon = '';
							let websitesi = '';
							let imgpaths = [];
							let adres = '';
							let calismasaatleri = '';
							let kategori = '';
							let yorumsayisi = '';
							let degerlendirmeorani = '';
							let yorumlar = [];
							let yildizli;
							let imgpathsdatabase = [];
							await detailsElement.click();
							await driver.sleep(5000);

							try {
								const nameElement = await driver.wait(
									until.elementLocated(By.css('h2[data-attrid="title"] > span')),
									5000
								);
								name = await nameElement.getText();
							} catch (e) {}
							if (output.includes(name)) {
								console.log('Zaten var');
								continue;
							}else{
								output.push(name);
							}
							try {
								const yildizli = await detailsElement.findElement(By.xpath('.//span[contains(@aria-label, "olarak değerlendirildi")]'));
								const degerlendirmeoraninofix1 = await yildizli.getAttribute('aria-label');
								const degerlendirmeoraninofix2 = degerlendirmeoraninofix1.replace("5 üzerinden ", "")
								degerlendirmeorani = degerlendirmeoraninofix2.replace(" olarak değerlendirildi,", "")
							} catch (e) {}
							try {
								const reviewSummaryDiv = await driver.findElement(By.css('div[data-attrid="kc:/collection/knowledge_panels/local_reviewable:review_summary"]'));
								const yorumSpan = await reviewSummaryDiv.findElement(By.xpath('.//span[contains(text(), "yorum")]'));
								const yorum = await yorumSpan.getText();
								yorumsayisi = parseInt(yorum.replace(" yorum", ""));
							} catch (e) {}
							try {
							  const locationAddressDiv = await driver.findElement(By.css('div[data-attrid="kc:/location/location:address"]'));
							  const secondSpan = await locationAddressDiv.findElement(By.css('span:nth-of-type(2)'));
							  adres = await secondSpan.getText();
							} catch (e) {}
							
							try {
								const elementphone = await driver.findElement(By.css('div[data-attrid="kc:/local:unified_actions"] a[data-phone-number]')); 
								const phoneNumber = await elementphone.getAttribute('data-phone-number');
							  telefon = phoneNumber;
							} catch (e) {
							  console.log(e);
							}
							try {
								const websitelementi = await driver.findElement(By.css('div[data-attrid="kc:/local:unified_actions"]'));
								const aElement = await websitelementi.findElement(By.css('a[ping]'));
								const hrefAttribute = await aElement.getAttribute('href');
								websitesi = hrefAttribute;
							} catch (e) {}
							try {
								const divElement = await driver.findElement(By.css('div[data-attrid="kc:/location/location:hours"]'));
								const tableElement = await divElement.findElement(By.tagName('table'));
								const html = await tableElement.getAttribute('outerHTML');
								calismasaatleri = html.replace(/<table.*?>|<\/table>|<tbody>|<\/tbody>|<tr.*?>|<\/tr>|<td.*?>/gi, '').replace(/<\/td>/gi, ' ').replace(/\n+/gi, '\n').trim();
							} catch (e) {}
							try {
								const mainDiv = await driver.findElement(By.css('div[data-attrid="kc:/location/location:media"]'));
								const subDivs = await mainDiv.findElements(By.css('div'));
								
								for (let i = 0; i < subDivs.length; i++) {
									const subDiv = subDivs[i];
									const styleAttribute = await subDiv.getAttribute('style');

									if (styleAttribute.includes('background-image')) {
										const backgroundImageUrl = styleAttribute.match(/url\(['"]?([^'"]+)['"]?\)/)[1];
										if (!imgpaths.includes(backgroundImageUrl)) {
											imgpaths.push(backgroundImageUrl);
										}
									}
								}
							} catch (e) {}
							try {
								if (imgpaths.length > 0) {
									const dir = './images/'+taramaid;
									if (!fs.existsSync(dir)) {
									  fs.mkdirSync(dir);
									}
									for (let i in imgpaths) {
										let imgpath = imgpaths[i];
										console.log('Processing image:', imgpath);
										var cleanedname = convertTurkishToEnglish(name) + '_' + i;
										const urlupdate = await updateImageUrl(imgpath,800,900);
										const response = await axios.get(urlupdate, { responseType: "stream" });
										imagePath = "./images/" + taramaid + "/" + path.basename(cleanedname.toLowerCase())+'.jpg';
										imagePathDb = "images/" + taramaid + "/" + path.basename(cleanedname.toLowerCase())+'.jpg';
										const fileWriterStream = fs.createWriteStream(imagePath.toLowerCase());
										response.data.pipe(fileWriterStream);
										if (!imgpathsdatabase.includes(imagePathDb)) {
											imgpathsdatabase.push(imagePathDb);
										}
									}
								}
							} catch (e) {}
							if(yorumcek == 1){	
								if (yorumsayisi != undefined && yorumsayisi != "İle ilgili yorumlar") {
									try {
										const element = await driver.wait(until.elementLocated(By.xpath('//span[contains(text(), "yorumlar")]')), 2000);
										await element.click();
										await driver.sleep(5000);
											try{
												let scrollDiv = await driver.findElement(By.css('div[data-attrid="kc:/local:all reviews"]'));
												await driver.executeScript('arguments[0].scrollIntoView()', scrollDiv);
												await driver.executeScript('arguments[0].scrollIntoView()', scrollDiv);
											}catch(e){}
										let divElements = await driver.findElements(By.className('gws-localreviews__google-review'));
										if(yorumdongusu == undefined){
											yorumdongusu = yorumsayisi / divElements.length;
										}
										for (let a = 0; a < yorumsayisi; a++) {
											let scrollDiv = await driver.findElement(By.css('div[data-attrid="kc:/local:all reviews"]'));
											await driver.executeScript('arguments[0].scrollIntoView()', scrollDiv);
											await new Promise(resolve => setTimeout(resolve, 3000));
											divElements = await driver.findElements(By.className('gws-localreviews__google-review'));
											if(yorumdongusu <= a){
												break;
											}
										}
										for (let i = 0; i < divElements.length; i++) {

											try {
												const linkElement = await driver.findElement(By.css('a.review-more-link'));
												await linkElement.click();
											} catch (e) {}
											const divElement = divElements[i];
											const spanElements = await divElement.findElements(By.css('span.review-snippet, span[data-expandable-section][tabindex="-1"]'));

											for (let j = 0; j < spanElements.length; j++) {
												const spanElement = spanElements[j];
												const spanText = await spanElement.getText();
												if (!yorumlar.includes(spanText) && spanText != "") {
													yorumlar.push(spanText);
												}
												
											}
											if(yorumlar.lenght >= yorumlimiti){
												break;
											}
										}
									} catch (e) {}
								}else{
									yorumsayisi = 0;
								}
							}
							if(isNaN(yorumsayisi)){
								yorumsayisi = 0;
							}
							try {
								const nameElement = await driver.wait(
									until.elementLocated(By.css('h2[data-attrid="title"] > span')),
									5000
								);
								name = await nameElement.getText();
							} catch (e) {}
							if(onlyphone == 1){
								if(phone == ""){
									
								}else{
									const query = 'INSERT INTO isletmeler SET name=?,phone=?,adres=?,url=?,calismasaatleri=?,imgpath=?,rating=?,ratingcategory=?,reviews=?,yorumlar=?,terim=?,owner=?,scanid=?,datetime=?,realimgpaths=?';
									const values = [name,telefon,adres,websitesi,calismasaatleri,JSON.stringify(imgpathsdatabase),degerlendirmeorani,kategori,yorumsayisi,JSON.stringify(yorumlar),terim,userid,taramaid,nowtime,JSON.stringify(imgpaths)];
									try {
										const results = await queryAsync(query, values);
										console.log('İşletme eklendi. '+name);
									} catch (e) {
										console.log(e);
									}
								}
							}else{
									const query = 'INSERT INTO isletmeler SET name=?,phone=?,adres=?,url=?,calismasaatleri=?,imgpath=?,rating=?,ratingcategory=?,reviews=?,yorumlar=?,terim=?,owner=?,scanid=?,datetime=?,realimgpaths=?';
									const values = [name,telefon,adres,websitesi,calismasaatleri,JSON.stringify(imgpathsdatabase),degerlendirmeorani,kategori,yorumsayisi,JSON.stringify(yorumlar),terim,userid,taramaid,nowtime,JSON.stringify(imgpaths)];
									try {
										const results = await queryAsync(query, values);
										console.log('İşletme eklendi. '+name);
									} catch (e) {
										console.log(e);
									}
							}
						}

						break;
					} catch (e) {
						const query = 'UPDATE gscrappers SET action=?,status=?,datetime=? WHERE gscrapeid=?';
						const values = ["Tarama:: Hata nedeniyle sonlandırıldı.",2,nowtime,taramaid];
						try {
							const results = await queryAsync(query, values);
						} catch (e) {
						}
					}
				}
			}
			
			const query = 'UPDATE gscrappers SET action=?,status=?,datetime=? WHERE gscrapeid=?';
			const values = ["Tarama:: Tamamlandı.",2,nowtime,taramaid];
			try {
				const results = await queryAsync(query, values);
			} catch (e) {
			}
			await driver.quit();
			await process.exit();
		}catch(e){
			const query = 'UPDATE gscrappers SET action=?,status=?,datetime=? WHERE gscrapeid=?';
			const values = ["Tarama:: Tarama tamamlandı.",2,nowtime,taramaid];
			try {
				const results = await queryAsync(query, values);
			} catch (e) {
			}
			await driver.quit();
			await process.exit();
		}
	
	}catch(e){
		const query = 'UPDATE gscrappers SET action=?,status=?,datetime=? WHERE gscrapeid=?';
		const values = ["Tarama:: Tarama bütünlüğü sonuçlandırıldı.",2,nowtime,taramaid];
		try {
			const results = await queryAsync(query, values);
		} catch (e) {
		}
		await driver.quit();
		await process.exit();
	}

})();
function convertTurkishToEnglish(str) {
	const turkishChars = 'çğıöşüÇĞİÖŞÜ';
	const englishChars = 'cgiosuCGIOSU';
	for (let i = 0; i < turkishChars.length; i++) {
		str = str.replace(new RegExp(turkishChars.charAt(i), 'g'), englishChars.charAt(i));
	}
	str = str.replace(/[^\w\s]/gi, '');
	str = str.replace(/\s+/g, '-');

	return str;
}
async function updateImageUrl(imageUrl, newWidth, newHeight) {
	let updatedUrl;

	if (imageUrl.includes('=w') && imageUrl.includes('-h')) {
	  updatedUrl = imageUrl.replace(/=w\d+/i, `=w${newWidth}`).replace(/-h\d+/i, `-h${newHeight}`).replace('http://', 'https://');
	} else if (imageUrl.includes('w=') && imageUrl.includes('h=')) {
	  updatedUrl = imageUrl.replace(/w=\d+/i, `w=${newWidth}`).replace(/h=\d+/i, `h=${newHeight}`).replace('http://', 'https://');
	} else {
	  return updatedUrl;
	}

  return updatedUrl;
}
