
const express = require("express");
const engines = require("consolidate");
const paypal = require('paypal-rest-sdk')
const axios = require('axios')

const djangoUrl = 'http://127.0.0.1:8000';
let authToken = '';
const baseUrl = 'http://10.0.2.2:3000';

axios({
  method: 'post',
  url: `${djangoUrl}/users/login/`,
  data: {
    username: 'rafa',
    password: 'rafa'
  }
})
  .then(res => authToken = res.data.token)
  .catch(err => {
    console.log('Error al conseguir el token')
    process.exit(1)
  })

const app = express();

app.engine("ejs", engines.ejs);
app.set("views", "./views");
app.set("view engine", "ejs");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

paypal.configure({
  'mode': 'sandbox',
  'client_id': 'AUS3HkWkPbAqhJ2witEcrhhNQBvtOUWhaVJQsijACc8N38RJkoHwbu_Pfs7dpmzNetvMNVMrwaokgq7g',
  'client_secret': 'ED7WeZL1dIEbKh65gfyRaFbOslKm14rlRV4mkwyozpNlH91HQFm3q2jJie8Qf1gl8vmKxywsVqUNr4vS'
});

app.get('/', (req, res) => {
  res.render('index');
});

app.post('/paypal', (req, res) => {
  const { type, user, sku, name, price } = req.body
  const create_payment_json = {
    intent: "sale",
    payer: {
      payment_method: "paypal"
    },
    redirect_urls: {
      return_url: `${baseUrl}/success?type=${type}&total=${price}&user=${user}&sku=${sku}`,
      cancel_url: `${baseUrl}/cancel`
    },
    transactions: [
      {
        item_list: {
          items: [
            {
              name: name,
              sku: sku,
              price: price,
              currency: "MXN",
              quantity: 1
            }
          ]
        },
        amount: {
          currency: "MXN",
          total: price
        },
        description: "This is the payment description."
      }
    ]
  };

  paypal.payment.create(create_payment_json, function (error, payment) {
    if (error) {
      throw error;
    } else {
      res.redirect(payment.links[1].href);
    }
  });
});

app.get('/success', (req, res) => {
  const { type } = req.query
  if (type === 'product') {
    buyProduct(req, res)
  } else if (type === 'subscription') {
    buySubscription(req, res)
  } else {
    console.log('No existe tipo de producto:', type)
    throw error
  }
});

const buyProduct = (req, res) => {
  const { user, sku, total } = req.query
  axios({
    method: 'post',
    url: `${djangoUrl}/sales/buy_product/`,
    headers: {
      'Authorization': `Token ${authToken}`
    },
    data: {
      product: sku,
      user,
      total
    }
  })
    .then(() => executePayment(req.query, res))
    .catch(err => {
      console.log(err.response.data)
      res.render('cancel')
    })
}

const buySubscription = (req, res) => {
  const { user } = req.query
  axios({
    method: 'post',
    url: `${djangoUrl}/sales/buy_subscription/`,
    headers: {
      'Authorization': `Token ${authToken}`
    },
    data: {
      user
    }
  })
    .then(() => executePayment(req.query, res))
    .catch(err => {
      console.log(err.response.data)
      res.render('cancel')
    })
}

const executePayment = ({ PayerID, paymentId, total, type }, res) => {
  const execute_payment_json = {
    payer_id: PayerID,
    transactions: [
      {
        amount: {
          currency: "MXN",
          total: total
        }
      }
    ]
  };

  paypal.payment.execute(paymentId, execute_payment_json, (error, payment) => {
    if (error) {
      console.log(error.response);
      throw error;
    } else {
      if (type === 'product') {
        res.render('product')
      } else {
        res.render('subscription')
      }
    }
  });
}


app.get('/cancel', (req, res) => {
  res.render("cancel")
});

app.listen(3000, () => {
  console.log('server running');
});