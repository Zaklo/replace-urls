# @zaklo/replace-urls

## About

check the github repo: https://github.com/Zaklo/replace-urls

This lib is used to generate static medias urls, from a builded project.

example: `https://res.cloudinary.com/zaklo/image/upload/v1621234567/my-image.jpg`

will be : `image_index_0.jpg`

## How to use

Start the development server on 

```bash
npm install replace-urls
```

Create a config file in your project root folder, named `config.js`


| Option name   | type                                                            |
|---------------|-----------------------------------------------------------------|
| htmlPath     | The html file to crawl                                          |
| mediaSrcSelector  | The prefixes of your images (ex: `https://res.cloudinary.com/`) |
| mediaDir | The directory where the static images will be                   |

example: 

```js
//config.js
module.exports = {
  htmlPath: '.output/public/china/index.html',
  mediaSrcSelector: 'img[src^="https://res.cloudinary.com"], video[src^="https://res.cloudinary.com"]',
  mediaDir: '.output/public/china/medias'
}
```

Then, in your `package.json` file, add a script to run the lib after the build

```json
{
  "scripts": {
    "generate": "your_generate_command && replace-urls --config ./config.js"
  }
}
```