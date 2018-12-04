/*
*
*
*       Complete the API routing below
*
*
*/

'use strict';

var expect = require('chai').expect;
var request = require('request');
var MongoClient = require('mongodb');

const CONNECTION_STRING = process.env.DB; //MongoClient.connect(CONNECTION_STRING, function(err, db) {});

var db;
MongoClient.connect(CONNECTION_STRING, function(err, DB) {
  if (!err) {
    db = DB;
    //console.log('connected');
  } else {
    console.log(err);
  }
});

function findPromise(stock) {
  return new Promise((resolve, reject) => {
    db.collection('stocks').findOne({stock: stock}, (err, data) => {
      if (!err) {
        resolve(data);
      } else {
        reject(err);
      }
    });
  })
};
function updatePromise(stock, like, ip) {
  if (like) {
    return new Promise((resolve, reject) => {
      db.collection('stocks').update(
        {stock: stock.stock},
        {$setOnInsert: {stock: stock.stock,  
                        price: stock.price}, 
         $addToSet: {likes: ip}},
        {upsert: true},
        (err, data) => {
        if (!err) {
          resolve(data);
        } else {
          reject(err);
        }
      });
    })     
  } else {  
    return new Promise((resolve, reject) => {
      db.collection('stocks').update(
        {stock: stock.stock},
        {$setOnInsert:{ stock: stock.stock,  
                        price: stock.price,
                        likes: [] }},
        {upsert: true},
        (err, data) => {
        if (!err) {
          resolve(data);
        } else {
          reject(err);
        }
      });
    }) 
  }  
};
function getStock(stock) {
  let url = 'https://api.iextrading.com/1.0/stock/' + stock + '/quote'
  return new Promise((resolve, reject) => {    
    request(url, {json:true}, (err, res, body) => {      
      if (!err) {
        resolve({'stock': body.symbol, 'price': body.latestPrice})
      } else {
        reject(err)
      }
    })
  })
};

module.exports = function (app) {

  app.route('/api/stock-prices')
    .get(function (req, res){
      //console.log(req.query)
      let stock = req.query.stock;
      let like = req.query.like;
      let ip = req.headers['x-forwarded-for'].split(",")[0];
      if (stock && !Array.isArray(stock)) { //if one stock
        let f = async () => {
          let get_stock = await getStock(stock);
          if (get_stock.stock !== undefined && get_stock.price !== undefined) {
            updatePromise(get_stock, like, ip);
            findPromise(get_stock.stock).then(data => { 
              res.json({"stockData":{"stock": data.stock, "price": data.price, "likes": data.likes.length}})
            })
            .catch(err => {
              //console.log(err)
            }) 
          }
        }
        f()
      }
      if (stock && Array.isArray(stock)) { //if two stocks
        let stock1 = stock[0];
        let stock2 = stock[1];
        let f = async () => {
          let get_stock1 = await getStock(stock1);
          let get_stock2 = await getStock(stock2);
          if (get_stock1.stock !== undefined && get_stock1.price !== undefined &&
              get_stock2.stock !== undefined && get_stock2.price !== undefined) {
            updatePromise(get_stock1, like, ip);
            updatePromise(get_stock2, like, ip);
            let stock1 = await findPromise(get_stock1.stock);
            let stock2 = await findPromise(get_stock2.stock);            
            if (stock1._id && stock2._id) {
              let stockData1 = {"stock": stock1.stock, "price": stock1.price, "rel_likes": stock1.likes.length - stock2.likes.length};
              let stockData2 = {"stock": stock2.stock, "price": stock2.price, "rel_likes": stock2.likes.length - stock1.likes.length};
              res.json({"stockData": [stockData2, stockData1]})
            }
          }
        }
        f()
      }
    });
    
};
