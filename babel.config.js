/*
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['nativewind/babel'],
  };
};
*/

module.exports = function(api) {
  api.cache(true);
  console.log("BABEL CONFIG LOADED");
  return {
    presets: ['babel-preset-expo'],
  };
};

