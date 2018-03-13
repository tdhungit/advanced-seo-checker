var path = require('path');
var fs = require('fs');
var SEOChecker = require(path.resolve('./src/index'));

var urls = ['http://hazemhagrass.com', 'http://hazemhagrass.com?x=1'];
var crawler = SEOChecker(urls[0], {});
crawler.analyze(urls).then(function (summary) {
  fs.writeFileSync('output.json', JSON.stringify(summary));
});
//An example to crawl URLs for certain website
// crawler.on('done', function (result) {
// fs.writeFileSync('output.json', JSON.stringify(result));
// });
// crawler.start();
