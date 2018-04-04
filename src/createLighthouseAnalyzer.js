const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const msg = require('./helpers/msg-helper');

module.exports = () => {
  function launchChromeAndRunLighthouse(url, flags = {}, config = null) {
    return chromeLauncher.launch(flags).then(chrome => {
      flags.port = chrome.port;

      return lighthouse(url, flags, config).then(results => {
        // The gathered artifacts are typically removed as they can be quite large (~50MB+)
        delete results.artifacts;
        return chrome.kill().then(() => results)
      });
    });
  }

  const flags = {
    chromeFlags: ['--headless'],
    handleSIGINT: true,
    maxConnectionRetries: 10
  };

  const analyzePage = (url) => {
    let trialsLimit = 5;
    let lunchingError = {};
    const init = (resolve, reject) => {
      trialsLimit--;
      if (trialsLimit === 0) {
        return resolve({error: lunchingError});
      }
      launchChromeAndRunLighthouse(url, flags).then(results => {
        resolve(results);
      }).catch((error) => {
        lunchingError = error;
        msg.error(lunchingError);
        init(resolve, reject);
      });
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
