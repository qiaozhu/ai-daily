// Default LIGHT regardless of system setting; only an explicit user toggle (stored) switches to dark.
(function(){var t='light';try{var v=JSON.parse(localStorage.getItem('aidaily.theme'));if(v==='dark'||v==='light')t=v;}catch(e){}document.documentElement.dataset.theme=t;})();
