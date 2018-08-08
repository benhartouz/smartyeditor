const express = require('express');
const verifyOAuth = require('../helpers').verifyOAuth;
const mongoose = require('mongoose');
const config = require('../config');

const Shop = mongoose.model('Shop');

const router = express.Router();

/* GET home page. */
router.get('/', (req, res, next) => {

  const query = Object.keys(req.query).map((key) => `${key}=${req.query[key]}`).join('&');

  var sessData = req.session;

  console.log("req.query.shop : ",req.query.shop);
  sessData.shopName = req.query.shop; 
  
  if (req.query.shop) {

      Shop.findOne({ shopify_domain: req.query.shop, isActive: true }, (err, shop) => {

          if (!shop) {
            return res.redirect(`/install/?${query}`);
          }

          if (verifyOAuth(req.query)) {
            return res.render('app/app', { apiKey: config.SHOPIFY_API_KEY, appName: config.APP_NAME, shop });
          }

          return res.render( 'index' , { title : req.query.shop } );

      });
      
  } else {

          return res.render('index', { title: 'Welcome to your example app' });

  }

});

// GET Product route
router.get('/products' , (req ,res ) => {

  const query = Object.keys(req.query).map((key) => `${key}=${req.query[key]}`).join('&');

  if (req.query.shop) {

    Shop.findOne({ shopify_domain: req.query.shop, isActive: true }, (err, shop) => {

        if (!shop) {
          return res.redirect(`/install/?${query}`);
        }

        return res.render('app/products', { products : "List of products" ,
                                            apiKey: config.SHOPIFY_API_KEY,
                                            appName: config.APP_NAME, 
                                            shop });

    });
    
  } else {

    return res.render('index', { title: 'Welcome to your example app' });

  }

});

// Error route
router.get('/error', (req, res) => res.render('error', { message: 'Something went wrong!' }));

module.exports = router;