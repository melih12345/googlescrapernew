const { Builder, By, Key, until } = require('selenium-webdriver');
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

const dir = './output';
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}


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

const args = parser.parse_args();

const terim = args.terim || "izmir'de yemek";
const fotow = args.fotow || 800;
const fotoh = args.fotoh || 600;
const userid = args.userid || 1;
const timeout = args.timeout || 6000;
const taramasayisi = args.taramasayisi || 32;
const onlyphone = args.onlyphone || 0;

let taramaid = generateUniqueId();

console.log(`Arama başlıyor: ${terim} `);
function generateUniqueId() {
  const buffer = crypto.randomBytes(4);
  return buffer.toString('hex').substring(0, 8);
}
(async function scrapeGoogleMaps() {

	
	const nowtime = moment().format('YYYY-MM-DD HH:mm:ss');
	const options = new chrome.Options();
	// options.setUserPreferences({ "profile.managed_default_content_settings.images": 1 });
	options.addArguments("--no-sandbox");
	
	const driver = await new Builder()
	  .forBrowser("firefox")
	  .setFirefoxOptions(options)
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
  try {
    await driver.get('https://www.google.com/maps/');
	await driver.sleep(1000);
    const elements = await driver.findElements(By.css(".widget-scene-canvas"));
    await driver.executeScript("var canvases = document.querySelectorAll('canvas'); canvases.forEach(function(canvas) { canvas.style.display='none'; })");
	
	try {
		const query = 'INSERT INTO gscrappers SET gscrapeid=?,scrapename=?,owner=?,status=?,action=?,datetime=?';
		const values = [taramaid,terim,userid,1,"Tarama:: İşlemler başladı.",nowtime];
		try {
		const results = await queryAsync(query, values);
			console.log('İşletme eklendi. '+name);
		} catch (e) {
		}
	} catch (e) {
	}

    const search_box = await driver.wait(
      until.elementLocated(By.id('searchboxinput')),
      20000
    );

    const search_query = `${terim}`;
    await search_box.sendKeys(search_query, Key.RETURN);

	try {
	  const businesses = await driver.wait(
		until.elementsLocated(By.className('hfpxzc')),
		10000
	  );

	} catch (e) {
		try{
		const query = 'UPDATE gscrappers SET action=?,status=?,datetime=? WHERE gscrapeid=?';
		const values = ["Hata:: Bu terime uygun işletme bulunamadı.",2,nowtime,taramaid];
		try {
		const results = await queryAsync(query, values);
		} catch (e) {
			}
			} catch (e) {
		await driver.quit();
		await process.exit();
	}	
	}
	try{
		const element = await driver.wait(until.elementLocated(By.css('button[jsaction="pane.queryOnPan.toggle;focus:pane.queryOnPan.toggle;blur:pane.queryOnPan.toggle;keydown:pane.queryOnPan.toggle"]')), 5000);
		await element.click();
	}catch (e){
		const query = 'UPDATE gscrappers SET action=?,status=?,datetime=? WHERE gscrapeid=?';
		const values = ["Tarama:: Tamamlandı.",2,nowtime,taramaid];
		try {
			const results = await queryAsync(query, values);
		} catch (e) {
		}
	}

    let output = [];
    let urls = [];
	let test = 0;
	let test2 = 0;
    while (true) {
		try {
		  const notFoundDiv = await driver.wait(
			until.elementLocated(By.xpath("//div[contains(text(),'Sonuç bulunamadı')]")),
			3000
		  );
		  
		  if (notFoundDiv) {
			console.log('Sonuç bulunamadı');
			break;
		  } else {
		  }
		} catch (e) {
		}
		  const businesses = await driver.wait(
        until.elementsLocated(By.className('hfpxzc')),
        10000
      );
	  if (!businesses) {
		break;
	  }
		for (const business of businesses) {
        const url = await business.getAttribute('href');
        if (!urls.includes(url)) {
			urls.push(url);
		  }
		}
		console.log(urls.length + 'adet işletme bulundu!'); // 4
				try{
					const query = 'UPDATE gscrappers SET action=?,datetime=? WHERE gscrapeid=?';
					const values = ["Tarama:: "+urls.length+" adet işletme bulundu.",nowtime,taramaid];
					try {
						const results = await queryAsync(query, values);
					} catch (e) {
					}
				} catch (e) {
				}
      await driver.executeScript(
        'arguments[0].scrollIntoView();',
        businesses[businesses.length - 1]
      );
	  
		await new Promise(resolve => setTimeout(resolve, 8000));

      const new_businesses = await driver.findElements(
        By.className('hfpxzc')
      );
      if (new_businesses.length === businesses.length) {
		  // break;
		if(test > 5){
			if(test2 > 10){
				try{
					const query = 'UPDATE gscrappers SET action=?,datetime=? WHERE gscrapeid=?';
					const values = ["Tarama:: "+urls.length+" adet işletme bulundu.",nowtime,taramaid];
					try {
						const results = await queryAsync(query, values);
					} catch (e) {
					}
				} catch (e) {
				}
				break;
			}else{
				if(test2 == 0){
					try{
						const element = await driver.wait(until.elementLocated(By.xpath('//button[contains(@aria-label, "Uzaklaştır")]')), 5000);
						await element.click();
						await driver.sleep(5000);
						await element.click();
						await driver.sleep(5000);
						await element.click();
						await driver.sleep(5000);
						await element.click();
						await driver.sleep(5000);
						await element.click();
						await driver.sleep(5000);
						await element.click();
						await driver.sleep(5000);
					} catch (e) {}	
					
					test2++;
				}else{
					try{
						const element = await driver.wait(until.elementLocated(By.xpath('//button[contains(@aria-label, "Uzaklaştır")]')), 5000);
						await element.click();
					} catch (e) {}
					test2++;
					await driver.sleep(5000);
				}
			}
		}else{
					try{
						const element = await driver.wait(until.elementLocated(By.xpath('//button[contains(@aria-label, "Yakınlaştır")]')), 5000);
						await element.click();
					} catch (e) {}	
			test++;
			await driver.sleep(5000);
		}

        
      }
	  
    }
	

    for (const url of urls) {
	let comments = [];
	try{
		await driver.get(url);
	} catch (e) {}
	await driver.sleep(2000);
	try{
		await driver.executeScript("var canvases = document.querySelectorAll('canvas'); canvases.forEach(function(canvas) { canvas.style.display='none'; })");
	} catch (e) {}	
    
		
	let name = '';
	let phone = '';
	let url_ = '';
	let imagePath = '';
	
	let adresAriaLabel = '';
	let calismasaatleri = '';
	let ratingcategorytext = '';
	let moreReviewstext = '';
	let ratingtext = '';
	let imagePathDb = '';
	let yorumlar = [];
	
      try {
        const nameElement = await driver.wait(
          until.elementLocated(By.className('fontHeadlineLarge')),
          8000
        );
        name = await nameElement.getText();
      } catch (e) {}
	  
      try {
        const ratingcategory = await driver.wait(
          until.elementLocated(By.css('button[jsaction="pane.rating.category"]')),
          500
        );
        ratingcategorytext = await ratingcategory.getText();
      } catch (e) {}
	  
      try {
		const yildizli = await driver.wait(
		  until.elementLocated(By.xpath('//span[contains(@aria-label, "yıldızlı")]')),
		  500
		);
        ratingtext = await await yildizli.getAttribute('aria-label');
      } catch (e) {}
	  
      try {
		const element = await driver.wait(until.elementLocated(By.xpath('//span[contains(@aria-label, "yorum")]')), 500);
		const ariaLabel = await element.getAttribute('aria-label');
		const commentCount = parseInt(ariaLabel.match(/\d+/)[0], 10);
        moreReviewstext = commentCount;
      } catch (e) {}

      try {
		const phoneElement = await driver.wait(
		  until.elementLocated(By.css('button[data-tooltip*="Telefon numarasını kopyala"]')),
		  500
		);
		phone = await phoneElement.getAttribute("aria-label");
      } catch (e) {}

      try {
        const urlElement = await driver.wait(
          until.elementLocated(By.css('[data-item-id*="authority"]')),
          1000
        );
        url_ = await urlElement.getAttribute('href');
		if(url_ === ""){
			url_ = "";
		}
      } catch (e) {}
	  
      try {
			const imgElement = await driver.wait(
			  until.elementLocated(By.css('button[jsaction="pane.heroHeaderImage.click"]')),
			  500
			);
			const dir = './images/'+taramaid;
			if (!fs.existsSync(dir)) {
			  fs.mkdirSync(dir);
			}
			var cleanedname = convertTurkishToEnglish(name);
			// var cleanedname = name.replace(/[^\w\s]|_/g, '')
			const imgSrc = await imgElement.findElement(By.tagName("img")).getAttribute("src");
			const urlupdate = await updateImageUrl(imgSrc,800,900);
			const response = await axios.get(urlupdate, { responseType: "stream" });
			imagePath = "./images/" + taramaid + "/" + path.basename(cleanedname.toLowerCase())+'.jpg';
			imagePathDb = "images/" + taramaid + "/" + path.basename(cleanedname.toLowerCase())+'.jpg';
			const fileWriterStream = fs.createWriteStream(imagePath.toLowerCase());
			response.data.pipe(fileWriterStream);
      } catch (e) {}
	  
      try {
		const adresElement = await driver.wait(
		  until.elementLocated(By.css('button[data-tooltip*="Adresi kopyala"]')),
		  500
		);
		adresAriaLabel = await adresElement.getAttribute("aria-label");
      } catch (e) {}
	  
		try{
			const buttons = await driver.findElements(By.css(`button[data-tooltip="Çalışma saatlerini kopyala"]`));
			let values = '';
			for (let i = 0; i < buttons.length; i++) {
			  const value = await buttons[i].getAttribute('data-value');
			  values += `${value} `;
			}
			calismasaatleri = values.trim();
		} catch (e) {}
		
		if(moreReviewstext != ""){
			try {
				const element = await driver.wait(until.elementLocated(By.xpath('//button[contains(@aria-label, "ile ilgili yorumlar")]')), 2000);
				await element.click();
			
				const yorumlarcek = await driver.wait(
				until.elementsLocated(By.css('.MyEned')),
				2000
				);
				for (let i = 0; i < yorumlarcek.length; i++) {
				  const yorumMetni = await yorumlarcek[i].getText();
					if (!yorumlar.includes(yorumMetni)) {
					  yorumlar.push(yorumMetni);
						// console.log(yorumMetni);
					}
				}
			} catch (e) {
			}	
		}
		if(onlyphone == 1){
			if(phone == ""){
				
			}else{
				const query = 'INSERT INTO isletmeler SET name=?,phone=?,adres=?,url=?,calismasaatleri=?,imgpath=?,rating=?,ratingcategory=?,reviews=?,yorumlar=?,terim=?,owner=?,scanid=?,datetime=?';
				const values = [name,phone,adresAriaLabel,url_,calismasaatleri,imagePathDb,ratingtext,ratingcategorytext,moreReviewstext,JSON.stringify(yorumlar),terim,userid,taramaid,nowtime];
				try {
					const results = await queryAsync(query, values);
					console.log('İşletme eklendi. '+name);
				} catch (e) {
				}
			}
		}else{
			const query = 'INSERT INTO isletmeler SET name=?,phone=?,adres=?,url=?,calismasaatleri=?,imgpath=?,rating=?,ratingcategory=?,reviews=?,yorumlar=?,terim=?,owner=?,scanid=?,datetime=?';
			const values = [name,phone,adresAriaLabel,url_,calismasaatleri,imagePathDb,ratingtext,ratingcategorytext,moreReviewstext,JSON.stringify(yorumlar),terim,userid,taramaid,nowtime];
			try {
				const results = await queryAsync(query, values);
				console.log('İşletme eklendi. '+name);
			} catch (e) {
			}
		}

		
	}	
		const query = 'UPDATE gscrappers SET action=?,status=?,datetime=? WHERE gscrapeid=?';
		const values = ["Tarama:: Tamamlandı.",2,nowtime,taramaid];
		try {
		const results = await queryAsync(query, values);
		} catch (e) {
		}
  } catch (e) {
    console.log('Error:', e);
		const query = 'UPDATE gscrappers SET action=?,status=?,datetime=? WHERE gscrapeid=?';
		const values = ["Tarama:: Tamamlandı.",2,nowtime,taramaid];
		try {
		const results = await queryAsync(query, values);
		} catch (e) {
		}
  } finally {
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
