/**
 * ./routes/api.js
 * This is where you'll set up any REST api endpoints you plan on using.
 */
const express     = require('express');
const verifyOAuth = require('../helpers').verifyOAuth;
const mongoose    = require('mongoose');
const config      = require('../config');
const requestPromise     = require("request-promise");
const request     = require("request");
const fs          = require('fs');

const Shop = mongoose.model('Shop');
const router = express.Router();


router.get('/', (req, res, next) => {

  res.sendStatus(200);

});


router.post('/update' , (req,res,next) => {

  let sess  = req.session;
  let shopname  = sess.shopName;
  let value = req.body.value; 


  Shop.findOne({ shopify_domain: shopname, isActive: true }, (err, shop) => {

      const accessToken           = shop.accessToken;
      const apiRequestHeader = {
        'X-Shopify-Access-Token' : accessToken
      }
      console.log("shop:",shop);
      const themeId = shop.themeId ;
      const url = 'https://' + shop.shopify_domain + "/admin/themes/" + themeId + "/assets.json";
      const json = {
        "asset": {
          "key": "assets/custom-css.css",
          "value": value
        }
      }

      req.object = {
        apiRequestHeader : apiRequestHeader , 
        url : url,
        json  : json
      }
      next();

  });

} , function(req,res){

      let url  = req.object.url;
      let apiRequestHeader  = req.object.apiRequestHeader;
      let json = req.object.json

      console.log(" Json : " , json);
      console.log(" Url : " , url);
      request({ url: url , method: 'PUT' , json: json , headers : apiRequestHeader } , function(err, resp, body) {
        if (err) {
          res.send({
            code : 304,
            message : "Can not modiy this"
          });
        } else {
          res.send({
              code : 200,
              message : "this is a message",
              data : resp
          });
        }
        res.end(200);
      });

});


router.get('/getproducts/:name', (req, res, next) => {
  
  const shopName = req.params.name;
  const query = Object.keys(req.query).map((key) => `${key}=${req.query[key]}`).join('&');

  if(shopName){

      Shop.findOne({ shopify_domain: shopName, isActive: true }, (err, shop) => {

        const accessToken           = shop.accessToken;
        const apiRequestUrl         = "https://" + shop.shopify_domain + "/admin/products.json";
        console.log("apiRequestUrl:",apiRequestUrl);
        console.log("shop:",shop);
        const apiRequestHeader = {
            'X-Shopify-Access-Token' : accessToken
        }

        requestPromise.get( apiRequestUrl , { headers : apiRequestHeader } ).
        then( (apiResponse) => {

          const data = {
            code : 200,
            message : "Success" , 
            apiResponse
          }
          res.end(apiResponse);

        }).
        catch( (error) => {

            return res.status(error.statusCode).send(error.error_desciption);

        });

        
      });

  }else{

    const data = {
      code : 404,
      message : "Shop not founded"
    }
    res.send(data);

  }

});

/* Get themes */
router.get("/themes/:name" , (req , res) => {

  const shopName = req.params.name;
  const query = Object.keys(req.query).map((key) => `${key}=${req.query[key]}`).join('&');

  if(shopName){

      Shop.findOne({ shopify_domain: shopName, isActive: true }, (err, shop) => {

        const accessToken           = shop.accessToken;
        const apiRequestUrl         = "https://" + shop.shopify_domain + "/admin/themes.json";
        const apiRequestHeader = {
            'X-Shopify-Access-Token' : accessToken
        }

        requestPromise.get( apiRequestUrl , { headers : apiRequestHeader } ).
        then( (apiResponse) => {

          const parsedResponseJson = JSON.parse(apiResponse);
          const themes = parsedResponseJson.themes;
          for(var i = 0 ; i < themes.length ; i++){
              if(themes[i].role === "main"){
                const themeId = themes[i].id;
                return new Promise(function(resolve, reject) {
                  
                  // Get theme file
                  const url = 'https://' + shop.shopify_domain + "/admin/themes/" + themeId + 
                              "/assets.json?asset[key]=layout/theme.liquid&theme_id=" + themeId;

                  request({ url: url , method: 'GET' ,  headers : apiRequestHeader } , function(err, resp, body) {
                    if (err) {
                      reject(err);
                    } else {
                      let parsedBody      = JSON.parse(body);
                      var parsedBodyValue = parsedBody.asset.value ;
                      let position        = parsedBodyValue.indexOf("</head>");
                      let textToinsert    = "    \n{{ 'custom-css.css' | asset_url | stylesheet_tag }}\n\n  " ; 
                      var result          = [parsedBodyValue.slice(0,position) , textToinsert , parsedBodyValue.slice(position)].join("");   
                      resolve({
                        themeId , 
                        result
                      });
                    }
                  });

                });
              }
          }
          return itemId;

        }).then(function(result){
            console.log("result",result);
            return new Promise(function(resolve , reject){

              const url = 'https://' + shop.shopify_domain + "/admin/themes/" + result.themeId + "/assets.json";
              const json = {
                "asset": {
                  "key": "layout/theme.liquid",
                  "value": result.result
                }
              }
              request({ url: url , method: 'PUT' , json: json , headers : apiRequestHeader } , function(err, resp, body) {
                if (err) {
                  reject(err);
                } else {
                  resolve(result.themeId);
                }
              });

            });
          
        }).then(function(result){

            // Do async job
            return new Promise(function(resolve,reject){
              // Update css files 
              const url = 'https://' + shop.shopify_domain + "/admin/themes/" + result.themeId + "/assets.json";
              const json = {
                "asset": {
                  "key": "assets/custom-css.css",
                  "value": "body { background : red }"
                }
              }
              request({ url: url , method: 'PUT' , json: json , headers : apiRequestHeader } , function(err, resp, body) {
                if (err) {
                  reject(err);
                } else {
                  resolve(body);
                }
              });
            });
            
        }).then(function(result){
            console.log(" success here we go");
            res.send(result);
            res.end(200);   
        }).
        catch( (error) => {

          console.log(" error here we go");
          res.send(error);
          res.end(500);   
            
        });

        
      });

  }else{

    const data = {
      code : 404,
      message : "Shop not founded"
    }
    res.send(data);

  }

});

module.exports = router;
