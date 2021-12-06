[![Kitsu](https://www.cg-wire.com/en/images/kitsu.png)](https://kitsu.cg-wire.com)

# Javascript client for Kitsu, Collaboration Platform for Animation Studios

This is a library to ease your life while connecting your javascript code to
Kitsu.

[![Build
badge](https://app.travis-ci.com/cgwire/kitsu.svg?branch=master)](https://app.travis-ci.com/cgwire/kitsu-client-js)

[![Discord](https://badgen.net/badge/icon/discord?icon=discord&label)](https://discord.com/invite/VbCxtKN)


## Documentation 


### Install

Installation can be done via npm:

```
npm i kitsu-client-js
```

### Usage

There is no specification avaialable at the moment. We invite you to browse the
code for checking if a function exists. You can propose yours too and submit it
via a pull request.


```
import kitsuClient from 'kitsu-client-js'

const client = kitsuClient.createClient('http://localhost:8080/api')

client.login('admin@example.com', )
  .then(client.getOpenProductions)
  .then(productions => {
    console.log(productions)
  })
```

## Contributing

As any open source project, we enjoy any contribution! You will find below 
how you can help the Kitsu project to get better.

### Bug reports 

All bugs must be submitted directly in 
[the issue page](https://github.com/cgwire/kitsu-client-js/issues) of this repository.

### Feature requests

Feature requests must be posted on our [Canny page](https://cgwire.canny.io/).

### Translations

If you want to contribute to translations, you can connect directly to the 
[POEditor platform](https://poeditor.com/join/project?hash=fpUejpWDVo).

### Code

All contributions are welcomed as long as they respect the [C4
contract](https://rfc.zeromq.org/spec:42/C4).

The Kitsu code is written with Javascript (ES6) and is based on the 
[VueJS](https://vuejs.org/v2/guide/) framework extended with 
the [Vuex](https://vuex.vuejs.org) plugin.

To install the development environment, follow [the dedicated guide](https://kitsu.cg-wire.com/development-environment/).

## About authors

Kitsu is written by CGWire, a company based in France. We help teams of animation
studios to collaborate better. We provide tools to more than 50 studios spread
all around the world.

On the technical side, we apply software craftmanship principles as much as
possible. We love coding and consider that strong quality and good developer
experience matter a lot.


Visit [cg-wire.com](https://cg-wire.com) for more information.

[![CGWire Logo](https://zou.cg-wire.com/cgwire.png)](https://cg-wire.com)
