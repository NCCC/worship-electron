const path = require("path");
const merge = require("webpack-merge");
const base = require("./webpack.base.config");

module.exports = env => {
  return merge(base(env), {
    entry: {
      control: "./src/control.js",
      presentation: "./src/presentation.js",
      background: "./src/background.js",
      edit: "./src/edit.js",
      app: "./src/app.js"
    },
    output: {
      filename: "[name].js",
      path: path.resolve(__dirname, "../app")
    }
  });
};
