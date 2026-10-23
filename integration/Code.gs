const DOCUMENT_VERSION = "61da25c4a17c0140496792c6f1fd9a6885de2c4e044f2962deeab817744139fa";
const DOCUMENTS = [{"id": "offer", "title": "Оферта", "path": "legal/2026-10-22/offer.html", "sourceSha256": "ccd59167933659940fff9167b37ccc212b03d43cd3554ab7b72d98aa85d293b1", "htmlSha256": "e5fa5b6321eda0632b7dbddf27594ea17d355265594bea6c1c23bff9d5dd5483"}, {"id": "privacy", "title": "Политика обработки персональных данных", "path": "legal/2026-10-22/privacy.html", "sourceSha256": "1b218edc67b3b4cb5250e13d0798f20084bcfaaa166ae8628428c8b49ea030f0", "htmlSha256": "6de32264ec5cd58ae7a0ceab4807fe459b97da693dba5bdd87a33cd08e576b85"}, {"id": "distribution", "title": "Согласие на распространение персональных данных", "path": "legal/2026-10-22/distribution.html", "sourceSha256": "e2de35eed03206a378fdd3e77832a0860ef0c8d08ee636d1dc11bd0bb53c43f9", "htmlSha256": "b04bf13933eaf46ef2d3a3ebd3afbf5639cf0154509e7d4bea140e70772960e9"}, {"id": "processing", "title": "Согласие на обработку персональных данных", "path": "legal/2026-10-22/processing.html", "sourceSha256": "f9a360e9a358ccdf24be4565ced7f59404a0658eb493b969e1b89eaadf54aeab", "htmlSha256": "83793fe65772b8960bce055301ff823131f42934519e4e195947c4dea918a2a0"}];
/** SPARK registration collector. Deploy as a Web App, running as the owner.
 * The spreadsheet MUST be private to organisers before accepting real entries.
 * Apps Script does not expose visitor IP in doPost; this limitation is explicit.
 */
const SPREADSHEET_ID = '1JdnMBYj6NPy45-jAsyOf-cLqepQSEnaPNOq69Tg7M4c';
const SHEET_NAME = 'Заявки СПАРК';
const HEADERS = ['ID заявки','Получено сервером (МСК)','ФИО','Email','Телефон','Оферта принята','Обработка ПД — согласие','Распространение ПД — согласие','Версия комплекта документов','Документы и SHA-256','Тексты подтверждений','Время отметок в браузере (не серверное)','Страница формы','Браузер (заявлено клиентом)','IP — доступность','Статус','Контрольная сумма заявки'];
const CONSENT_TEXTS = {
  offer:'Я ознакомился(-ась) и согласен(-на) с условиями оферты.',
  processing:'Даю согласие на обработку персональных данных в соответствии с Политикой обработки персональных данных.',
  distribution:'Даю согласие на распространение персональных данных.'
};
function response_(data) {return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);}
function doGet() {return response_({ok:true,service:'SPARK registration'});}
function validate_(p) {
  if (!p || !/^[a-f0-9]{32}$/.test(p.requestId||'')) throw Error('INVALID_REQUEST');
  if (p.documentVersion!==DOCUMENT_VERSION) throw Error('VERSION_MISMATCH');
  if (p.website) throw Error('INVALID_REQUEST');
  if (typeof p.fullName!=='string'||p.fullName.length>160||p.fullName.trim().split(/\s+/).length<2) throw Error('INVALID_NAME');
  if (typeof p.email!=='string'||p.email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(p.email)) throw Error('INVALID_EMAIL');
  if (!/^\+[1-9]\d{7,14}$/.test(p.phone||'')) throw Error('INVALID_PHONE');
  if (!p.consent||p.consent.offer!==true||p.consent.processing!==true||typeof p.consent.distribution!=='boolean') throw Error('CONSENT_REQUIRED');
  if (typeof p.source!=='string'||p.source.length>1000||!p.source.startsWith('https://spark-conference.github.io/spark2/')) throw Error('INVALID_SOURCE');
  if (typeof p.userAgent!=='string'||p.userAgent.length>500) throw Error('INVALID_REQUEST');
  if (!p.acceptedAt||typeof p.acceptedAt!=='object') throw Error('INVALID_REQUEST');
  for (const k of ['offer','processing','distribution']) {
    if (p.consent[k] && (typeof p.acceptedAt[k]!=='string'||p.acceptedAt[k].length>40||!Number.isFinite(Date.parse(p.acceptedAt[k])))) throw Error('INVALID_REQUEST');
  }
}
function hash_(value){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value,Utilities.Charset.UTF_8).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');}
function safe_(value){const s=String(value);return /^[\s]*[=+\-@\t\r\n]/.test(s)?"'"+s:s;}
function getSheet_(){
  const ss=SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet=ss.getSheetByName(SHEET_NAME);
  if(!sheet){sheet=ss.insertSheet(SHEET_NAME);sheet.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);sheet.setFrozenRows(1);
    sheet.getRange(1,1,1,HEADERS.length).setBackground('#070b28').setFontColor('#fff1d3').setFontWeight('bold').setWrap(true);
    sheet.setRowHeight(1,58);sheet.setColumnWidths(1,HEADERS.length,180);sheet.setColumnWidth(3,240);sheet.setColumnWidth(4,240);
  }
  const headers=sheet.getRange(1,1,1,HEADERS.length).getValues()[0];
  if(headers.some((x,i)=>x!==HEADERS[i]))throw Error('SHEET_LAYOUT_CHANGED');
  return sheet;
}
function doPost(e){
  let lock;
  try{
    if(!e||e.contentLength>16000||!e.parameter||!e.parameter.payload)throw Error('INVALID_REQUEST');
    const p=JSON.parse(e.parameter.payload);validate_(p);
    const digest=hash_(JSON.stringify({fullName:p.fullName,email:p.email,phone:p.phone,consent:p.consent,acceptedAt:p.acceptedAt,documentVersion:p.documentVersion}));
    lock=LockService.getScriptLock();if(!lock.tryLock(20000))throw Error('BUSY');
    const sheet=getSheet_();const last=sheet.getLastRow();
    if(last>1){
      const found=sheet.getRange(2,1,last-1,1).createTextFinder(p.requestId).matchEntireCell(true).findNext();
      if(found){
        if(sheet.getRange(found.getRow(),HEADERS.length).getValue()!==digest)throw Error('ID_CONFLICT');
        return response_({ok:true,requestId:p.requestId,duplicate:true});
      }
    }
    // Throttle repeated submissions per contact without exposing or logging the contact.
    const cache=CacheService.getScriptCache();const key='rate-'+hash_(p.email.toLowerCase());
    const hits=Number(cache.get(key)||0);if(hits>=5)throw Error('RATE_LIMIT');
    const timestamp=Utilities.formatDate(new Date(),'Europe/Moscow','yyyy-MM-dd HH:mm:ss');
    const row=[p.requestId,timestamp,p.fullName,p.email,p.phone,'Да','Да',p.consent.distribution?'Да':'Нет',DOCUMENT_VERSION,
      JSON.stringify(DOCUMENTS),JSON.stringify(CONSENT_TEXTS),JSON.stringify(p.acceptedAt),p.source,p.userAgent,
      'Apps Script не передаёт IP посетителя','Заявка сохранена; оплата не подтверждена',digest];
    sheet.getRange(last+1,1,1,row.length).setNumberFormat('@').setValues([row.map(safe_)]);
    SpreadsheetApp.flush();cache.put(key,String(hits+1),60);
    return response_({ok:true,requestId:p.requestId});
  }catch(error){
    const allowed=['INVALID_REQUEST','VERSION_MISMATCH','INVALID_NAME','INVALID_EMAIL','INVALID_PHONE','CONSENT_REQUIRED','INVALID_SOURCE','SHEET_LAYOUT_CHANGED','ID_CONFLICT','RATE_LIMIT','BUSY'];
    return response_({ok:false,code:allowed.includes(error.message)?error.message:'SAVE_FAILED'});
  }finally{if(lock&&lock.hasLock())lock.releaseLock();}
}
