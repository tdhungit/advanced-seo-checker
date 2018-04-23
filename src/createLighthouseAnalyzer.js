const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const msg = require('./helpers/msg-helper');
const exec = require('child_process').exec;
const crypto = require('crypto');
const fs = require('fs');

module.exports = () => {
  function launchChromeAndRunLighthouse(url, flags = {}, config = null) {
    return chromeLauncher.launch(flags).then(chrome => {
      flags.port = chrome.port;

      function init(resolve, reject){
        msg.info('Waiting for Chrome instance to be ready');
        setTimeout(function(){
          msg.info('Testing using lighthouse using nodejs');
          //Wait to make sure that chrome instance is there and ready to serve
          lighthouse(url, flags, config).then(results => {
            // The gathered artifacts are typically removed as they can be quite large (~50MB+)
            delete results.artifacts;
            chrome.kill().then(() => {
              msg.info('Chrome instance was killed successfully');
              resolve(results);
            });
          }).catch((error) => {
            reject(error);
          });
        }, 5000);
        
      }
      let promise = new Promise(init);
      return promise;
      
    });
  }
  function launchChromeAndRunLighthouseViaBash(url, flags = {}, config = null) {
     msg.info('Testing using enviroment lighthouse using bash script');
    function init(resolve, reject){
      const jsonName = crypto.createHash('md5').update(url).digest('hex') + '.json';
      var yourscript = exec("lighthouse '" + url + "' --quiet --chrome-flags='--headless' --output=json --output-path=" + jsonName,
        (error, stdout, stderr) => {
            if (error === null) {
              const results = JSON.parse(fs.readFileSync(jsonName, 'utf8'));
              delete results.artifacts;
              setTimeout(function(){
                msg.info('Deleting ' + jsonName);
                fs.unlink(jsonName);
              }, 1000);
              resolve(results);
            } else{
              reject(error);
            }
        });
    }
    let promise = new Promise(init);
    return promise;
  }
  
  const flags = {
    chromeFlags: ['--headless'],
    handleSIGINT: true,
    maxConnectionRetries: 2
  };

  const analyzePage = (url) => {
    let trialsLimit = 2;
    let lunchingError = {};
    const init = (resolve, reject) => {
      trialsLimit--;
      if (trialsLimit === 0) {
        launchChromeAndRunLighthouseViaBash(url, flags).then(results => {
          resolve(results);
        }).catch((error) => {
          lunchingError = error;
          msg.error(lunchingError);
          init(resolve, reject);
        });
      }
      else {
        launchChromeAndRunLighthouse(url, flags).then(results => {
          resolve(results);
        }).catch((error) => {
          lunchingError = error;
          msg.error(lunchingError);
          init(resolve, reject);
        });
      }
    };

    let promise = new Promise(init);
    return promise;
  };

  const analyzePages = (urls) => {
    const init = (resolve, reject) => {
      const promises = [];
      for (let i = 0; i < urls.length; i++) {
        promises.push(analyzePage(urls[i]));
      }
      Promise.all(promises).then(function (summary) {
        resolve(summary);
      });
    };

    let promise = new Promise(init);
    return promise;
  };

  return {
    analyzePage,
    analyzePages
  }
};
