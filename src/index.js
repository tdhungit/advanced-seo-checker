const http = require('http');
const parseURL = require('url-parse');
const request = require('request');
const urlExists = require('url-exists');
const normalizeUrl = require('normalize-url');
const mitt = require('mitt');
const createAnalyzer = require('./createAnalyzer');
const ssllabs = require("node-ssllabs");
const msg = require('./helpers/msg-helper');

module.exports = function AdvancedSEOChecker(uri, opts) {
  const defaultOpts = {
    ignoreSSLTest: true,
    ignoreRobotsTest: true,
    ignoreSitemapTest: true,
    ignoreInternalPagesIssues: false,
    useTerminalOption: false
  };
  const options = Object.assign({}, defaultOpts, opts);
  if (options.ignoreInternalPagesIssues) {
    options.ignoreSSLTest = false;
    options.ignoreRobotsTest = false;
    options.ignoreSitemapTest = false;
  }
  if (!uri) {
    throw new Error('Requires a valid URL.');
  }

  const emitter = mitt();
  const parsedUrl = parseURL(
    normalizeUrl(uri, {
      stripWWW: false,
      removeTrailingSlash: false
    })
  );

  const getValidatedURL = (url) => {
    // Check if user input protocol
    if (url.indexOf('http://') < 0 && url.indexOf('https://') < 0) { // TODO: Turn this into its own function
      url = 'http://' + url;
    }
    return url;
  }
  const load = (url) => {
    let limit = 3;
    const getPage = (url, done) => {
      request.get(url.toLowerCase(), function (error, response, body) {
        if (!error || limit === 0) {
          return done(error, body);
        }
        limit--;
        return getPage(url, done);
      });
    };
    const init = (resolve, reject) => {
      url = getValidatedURL(url);
      // Make request and fire callback
      getPage(url.toLowerCase(), function (error, body) {
        if (!error) {
          return resolve(body);
        }
        return resolve('');
      });
    };

    let promise = new Promise(init);
    return promise;
  };
  const analyze = (urls, bodies) => {
    let res = {};
    const analyzer = createAnalyzer(options);
    urls = Array.isArray(urls) ? urls : [urls];
    const onBodiesLoad = (bodies, resolve, reject) => {
      msg.appMsg('Retrieving urls bodies done');
      msg.appMsg('Start analyzing urls');
      const promises = [validateSitemap(), validateRobots(), testSSLCertificate(normalizeUrl(uri)),
        analyzer.analyzePages(urls, bodies)];
      Promise.all(promises).then(function (result) {
        res = result[3];
        if (!options.ignoreSSLTest) {
          res.issues.warnings.ssl = result[2];
        }
        if (!options.ignoreSitemapTest) {
          res.issues.notices.sitemap = result[0];
        }
        if (!options.ignoreRobotsTest) {
          res.issues.notices.robots = result[1];
        }

        msg.green('Analyzing urls done');
        resolve(res);
      }).catch(function (err) {
        reject(err);
      });
    };

    const init = (resolve, reject) => {
      if (bodies) {
        onBodiesLoad(bodies, resolve, reject);
      }
      else {
        const bodiesPromises = [];
        for (let i = 0; i < urls.length; i++) {
          bodiesPromises.push(load(urls[i]));
        }
        msg.appMsg('Start retrieving urls bodies');
        Promise.all(bodiesPromises).then(function (bodies) {
          onBodiesLoad(bodies, resolve, reject);
        });
      }
    };

    let promise = new Promise(init);
    return promise;
  };
  const testSSLCertificate = (url) => {
    const init = (resolve, reject) => {
      if (options.ignoreSSLTest) {
        return resolve();
      }

      msg.appMsg('Starting SSLLabs test');
      ssllabs.scan(url, function (err, host) {
        msg.appMsg('SSLLabs test was done');
        const result = {
          summary: '',
          grades: [],
          value: host,
          score: 0,
          weight: 1
        };
        const gradeScores = {
          'A+': 100,
          'A': 80,
          'B': 65,
          'C': 50,
          'D': 35,
          'E': 20,
          'F': 10
        };
        if (err || !host) {
          return resolve(result);
        }
        host.endpoints.forEach(function (endpoint) {
          if (!endpoint.grade) {
            return;
          }
          result.score += gradeScores[endpoint.grade] ? gradeScores[endpoint.grade] : 0;
          result.grades.push(endpoint.grade);
        });
        result.score = result.grades.length ? result.score / result.grades.length : 0;
        result.impact = result.score * result.weight;
        result.summary = !result.grades.length ? 'No SSL certificate detected' : '';
        resolve(result);
      });
    };

    let promise = new Promise(init);
    return promise;
  };
  const validateSitemap = () => {
    let url = parsedUrl.href;
    const init = (resolve, reject) => {
      if (options.ignoreSitemapTest) {
        return resolve();
      }
      urlExists(normalizeUrl(url) + '/sitemap.xml', function (err, exists) {
        msg.appMsg('Sitemap test was done');
        resolve({
          summary: !exists ? 'Sitemap.xml not found' : 'Sitemap.xml was found',
          value: exists,
          weight: 1,
          score: exists ? 100 : 0,
          impact: !exists ? 100 : 0
        });
      });
    };
    let promise = new Promise(init);
    return promise;
  };
  const validateRobots = () => {
    let url = parsedUrl.href;
    const init = (resolve, reject) => {
      if (options.ignoreRobotsTest) {
        return resolve();
      }
      urlExists(normalizeUrl(url) + '/robots.txt', function (err, exists) {
        msg.appMsg('robots test was done');
        resolve({
          summary: !exists ? 'Robots.txt not found' : 'Robots.txt was found',
          value: exists,
          weight: 1,
          score: exists ? 100 : 0,
          impact: !exists ? 100 : 0
        });
      });
    };
    let promise = new Promise(init);
    return promise;
  };

  const emitError = (code, url) => {
    emitter.emit('error', {
      code,
      message: http.STATUS_CODES[code],
      url
    });
  };

  return {
    on: emitter.on,
    off: emitter.off,
    load,
    analyze
  }
};
