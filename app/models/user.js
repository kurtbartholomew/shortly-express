var db = require('../config');
var Promise = require('bluebird');
var Link = require('./link.js');

var User = db.Model.extend({
  tableName: 'users',
  links: function(){
    return this.hasMany(Link);
  }
});

module.exports = User;
