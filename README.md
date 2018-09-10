# Advanced SEO Checker [![Build Status](https://travis-ci.org/Clever-Labs/seo-checker.svg?branch=master)](https://travis-ci.org/Clever-Labs/seo-checker)

> A library for checking basic SEO signals on a web page

## Usage

Install with npm `npm install https://github.com/tdhungit/advanced-seo-checker.git --save`

### Getting started

Require the library and then all the methods listed below will be made available to you.

The `analyze` method takes the URLs' list as a parameter to start analyzing them

<!-- TODO: Document options -->

```js
const SEOChecker = require('advanced-seo-checker');
let baseURL = 'https://youaddon.com';
let urls = [baseURL, 'https://youaddon.com/category/1/themes'];
let crawler = SEOChecker(baseURL, {});
crawler.analyze(urls).then(function (summary) {
  let util = require('util');
  console.log(util.inspect(summary));
});
```


Most of the items in the returned object are self explanatory. Here are the ones that may not be obvious:

* `heading1`: This is the text of the first H1 heading tag on the page
* `totalHeadings`: Counts how many H1 tags on a page
* `imgAccessibility` - This is the percentage of images on a page that have no `alt` or `title` attributes.

## Development

1. Clone the repository `git clone https://github.com/tdhungit/advanced-seo-checker.git && cd advanced-seo-checker`
2. Install dependencies `npm install`

Now you can develop!

## Contributing

Contributions are very welcome! This is a project we created to fulfill a pretty specific use case. Although we tried to make it as generic as possible we think we can improve. So if you want to expand on our work and make this library appeal to a broader range of use cases or platforms then please share your pull requests and we'll accept them.
