const express = require('express');
const Shop = require('../models/Shop');
const Shopify = require('shopify-node-api');
const config = require('../config');
const generateNonce = require('../helpers').generateNonce;
const buildWebhook = require('../helpers').buildWebhook;

const requestPromise     = require("request-promise");
const request     = require("request");

const router = express.Router();

router.get('/', (req, res) => {
  
  /*
  // Clear database
  Shop.remove({}, (error) => {
    if (error) {
      console.error('Could not remove Shop database entries: ', error);
    } else {
      console.log('Successfully cleared Shop');
    }
  });
  */

  const shopName = `${req.query.shop}.myshopify.com`;
  const nonce    = generateNonce();
  const query    = Shop.findOne({ shopify_domain: shopName }).exec();

  const shopAPI = new Shopify({
    shop: shopName,
    shopify_api_key: config.SHOPIFY_API_KEY,
    shopify_shared_secret: config.SHOPIFY_SHARED_SECRET,
    shopify_scope: config.APP_SCOPE,
    nonce,
    redirect_uri: `${config.APP_URI}/install/callback`,
  });

  const redirectURI = shopAPI.buildAuthURL();

  query.then((response) => {
    let save;
    const shop = response;
    if (!shop) {
      save = new Shop({ shopify_domain: shopName, nonce }).save();
    } else {
      shop.shopify_domain = shopName;
      shop.nonce = nonce;
      save = shop.save();
    }
    return save.then(() => res.redirect(redirectURI));
  });
});

router.get('/callback', (req, res) => {
  const params = req.query;
  const query = Shop.findOne({ shopify_domain: params.shop }).exec();
  query.then((result) => {
    const shop = result;
    const shopAPI = new Shopify({
      shop: params.shop,
      shopify_api_key: config.SHOPIFY_API_KEY,
      shopify_shared_secret: config.SHOPIFY_SHARED_SECRET,
      nonce: shop.nonce,
    });
    shopAPI.exchange_temporary_token(params, (error, data) => {
      if (error) {
        console.log(error);
        res.redirect('/error');
      }
      shop.accessToken = data.access_token;
      shop.isActive = true;

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
              shop.themeId = themeId;
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
                resolve({themeId:result.themeId});
              }
            });

          });
        
      }).then(function(result){

          console.log( "Uploading file to theme here we go !" , result.themeId );
          // Do async job
          return new Promise(function(resolve,reject){
              // Update css files 
              const url = 'https://' + shop.shopify_domain + "/admin/themes/" + result.themeId + "/assets.json";
              const json = {
                "asset": {
                  "key"   : "assets/custom-css.css",
                  "value" : ".page-wrapper.page-element {background: red;}"
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
          
        return  new Promise(function( resolve , reject ){
            shop.save( (saveError) => {
              if (saveError) {
                res.redirect('/error')
                reject();
              }else{
                if (config.APP_STORE_NAME) {
                  res.redirect(`https://${shop.shopify_domain}/admin/apps/${config.APP_STORE_NAME}`);
                } else {
                  res.redirect(`https://${shop.shopify_domain}/admin/apps`);
                }
                  resolve();
              }

            });
        });

      }).
      catch( (error) => {
        console.log(" error here we go");
        res.send(error);
        res.end(500);   
      });

    });
  });
});

module.exports = router;
