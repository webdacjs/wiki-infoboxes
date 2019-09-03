# wiki-infoboxes

As defined by wikipedia: *An infobox is a fixed-format table usually added to the top right-hand corner of articles to consistently present a summary of some unifying aspect that the articles share and sometimes to improve navigation to other interrelated articles*

This module Extract those wikipedia articles infoboxes in a structured JSON format, that can be consumed by other modules or applications. For example:

```js
> const { fetchSearchInfoBoxes } = require('wiki-infoboxes')
> fetchSearchInfoBoxes('republic of ireland').then(x => console.log(x))
> {
    conventional_long_name: { text: 'Ireland' },
    common_name: { text: 'Ireland' },
    linking_name: { text: 'the Republic of Ireland' },
    area_link: { text: '#Geography' },
    image_flag: { text: 'Flag of Ireland.svg' },
    flag_caption: { text: 'Flag' },
    symbol_width: { text: '65px' },
    ...
}
```

## Install

You can install with [npm]:

```sh
$ npm install --save wiki-infoboxes
```

## Usage

The module provides two main functions: `fetchInfoBoxes` and `fetchSearchInfoBoxes`. You can use the first one if you know the exact wikipedia page title and latter if you don't know the exact title and want tor search for it. Both are used in similar fashion:

```js
> const { fetchInfoBoxes, fetchSearchInfoBoxes,  } = require('wiki-infoboxes')
> fetchInfoBoxes('Anglo-Irish Treaty').then(x => console.log(x))
> {
    name: { text: 'Anglo-Irish Treaty' },
    long_name: { text: 'Articles of Agreement for a Treaty Between Great Britain and Ireland' },
    image: { text: 'Anglo-Irish Treaty signatures.gif' },
    image_width: { text: '200px' },
    caption: { text: 'Signature page' },
    date_signed: { text: '6 December 1921' },
    ...
}

```

### License

Copyright © 2019, [Juan Convers](https://juanconvers.com/).
Released under the [MIT License](LICENSE).