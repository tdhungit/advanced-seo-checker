var path = require('path');
var fs = require('fs');
var SEOChecker = require(path.resolve('./src/index'));

var url = ['http://hazemhagrass.com', 'http://hazemhagrass.com?x=1', 'http://hazemhagrass.com/blog'];
var crawler = SEOChecker(url[0], {});
crawler.analyze(url).then(function (summary) {
  fs.writeFileSync('output.json', JSON.stringify(summary));
});
//An example to crawl URLs for certain website
// crawler.on('done', function (result) {
// fs.writeFileSync('output.json', JSON.stringify(result));
// });
// crawler.start();
