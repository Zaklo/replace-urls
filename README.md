# @zaklo/replace-urls

## About

This lib is used to generate static medias urls, from a builded project.

example: `https://res.cloudinary.com/zaklo/image/upload/v1621234567/my-image.jpg`

will be : `image_index_0.jpg`

## How to use

Start the development server on 

```bash
npm install replace-urls
```

Create a config file in your project root folder, named `replace-urls.config.json`


| Option name   | type                                                            |
|---------------|-----------------------------------------------------------------|
| html_file     | The html file to crawl                                          |
| image_prefix  | The prefixes of your images (ex: `https://res.cloudinary.com/`) |
| out_directory | The directory where the static images will be                   |

example: 

```json
//replace-urls.config.json
{
  "html_file": "dist/index.html",
  "image_prefix": "https://res.cloudinary.com/",
  "out_directory": "dist/images/static/"
}
```

Then, in your `package.json` file, add a script to run the lib after the build

```json
//package.json
{
  "scripts": {
    "build": "your_build_command && replace-urls"
  }
}
```