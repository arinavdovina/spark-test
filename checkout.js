/* Registration is confirmed by the server before any payment navigation. */
(() => {
  const form = document.querySelector('#registration-form');
  if (!form) return;
  const config = window.SPARK_CHECKOUT || {};
  const dialog = document.querySelector('#checkout-dialog');
  const button = form.querySelector('[type="submit"]');
  const status = form.querySelector('#checkout-status');
  const email = form.elements.email, name = form.elements.fullName, phone = form.elements.phone;
  let pending = false, requestId = null, fingerprint = null, trigger = null;
  const acceptedAt = {};
  ['offer','processing','distribution'].forEach(key => {
    form.elements[key].addEventListener('change', () => {
      acceptedAt[key] = form.elements[key].checked ? new Date().toISOString() : null;
    });
  });
  if (dialog && typeof dialog.showModal === 'function') {
    document.querySelectorAll('[data-checkout]').forEach(link => link.addEventListener('click', event => {
      event.preventDefault(); trigger=link; dialog.showModal(); document.body.classList.add('checkout-open');
    }));
    dialog.querySelector('.checkout-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { document.body.classList.remove('checkout-open'); if(trigger)trigger.focus(); });
  }
  [name,phone,email].forEach(input=>input.addEventListener('input',()=>input.setCustomValidity('')));
  function normalizePhone(value) {
    let digits=value.replace(/\D/g,'');
    if (digits.length===11 && digits[0]==='8') digits='7'+digits.slice(1);
    return '+'+digits;
  }
  function validate() {
    name.value=name.value.trim().replace(/\s+/g,' ');email.value=email.value.trim();
    name.setCustomValidity(name.value.split(' ').filter(Boolean).length<2?'Укажите фамилию и имя.':'');
    const normalized=normalizePhone(phone.value);
    phone.setCustomValidity(/^\+[1-9]\d{7,14}$/.test(normalized)?'':'Укажите телефон с кодом страны.');
    if(!form.reportValidity())return null;
    return {fullName:name.value,email:email.value,phone:normalized};
  }
  function newId() {
    const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);
    return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  }
  function proceedToPayment() {
    // Contact details stay out of URLs. This payment link does not accept POST prefilling.
    location.assign(config.paymentUrl);
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(pending)return;
    status.textContent='';const data=validate();if(!data)return;
    if(!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(config.endpoint||'')){
      status.textContent='Запись временно недоступна. Пожалуйста, свяжитесь с организатором: Dolersi88@gmail.com. Ваши данные не отправлены.';return;
    }
    const consent={offer:form.elements.offer.checked,processing:form.elements.processing.checked,distribution:form.elements.distribution.checked};
    const current=JSON.stringify({data,consent,acceptedAt,version:config.documentVersion});
    if(current!==fingerprint){requestId=newId();fingerprint=current;}
    pending=true;button.disabled=true;button.textContent='Сохраняем заявку…';status.textContent='';
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),25000);
    try{
      const payload={...data,consent,acceptedAt,requestId,documentVersion:config.documentVersion,
        website:form.elements.website.value,source:location.origin+location.pathname,userAgent:navigator.userAgent.slice(0,500)};
      const response=await fetch(config.endpoint,{method:'POST',credentials:'omit',redirect:'follow',referrerPolicy:'no-referrer',
        body:new URLSearchParams({payload:JSON.stringify(payload)}),signal:controller.signal});
      if(!response.ok)throw Error('save-failed');
      const result=await response.json();
      if(result.ok!==true||result.requestId!==requestId)throw Error(result.code==='VERSION_MISMATCH'?'stale':'save-failed');
      button.textContent='Открываем Prodamus…';
      proceedToPayment(data,requestId);
    }catch(error){
      status.textContent=error.message==='stale'?'Документы обновились. Обновите страницу и ознакомьтесь с ними ещё раз.':
        'Не удалось подтвердить сохранение заявки. Переход к оплате не выполнен. Повторите попытку; при повторной отправке этой же заявки дубликат не создаётся.';
    }finally{clearTimeout(timer);pending=false;button.disabled=false;button.textContent='Перейти к оплате ↗';}
  });
})();
