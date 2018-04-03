const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');

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
    chromeFlags: ['--headless']
  };

  const analyzePage = (url) => {
    const init = (resolve, reject) => {
      launchChromeAndRunLighthouse(url, flags).then(results => {
        resolve(results);
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
