App = {
    web3Provider: null,
    contracts: {},
    account: 0X0,
    loading: false,

    init: async () => {
        return App.initWeb3();
    },

    initWeb3: async () => {
        if(window.ethereum) {
            window.web3 = new Web3(window.ethereum);
            try {
                await window.ethereum.enable();
                App.displayAccountInfo();
                return App.initContract();
            } catch(error) {
                //user denied access
                console.error("Unable to retrieve your accounts! You have to approve this application on Metamask");
            }
        } else if(window.web3) {
            window.web3 = new Web3(web3.currentProvider || "ws://localhost:8545");
            App.displayAccountInfo();
            return App.initContract();
        } else {
            //no dapp browser
            console.log("Non-ethereum browser detected. You should consider trying Metamask");
        }
    },

    displayAccountInfo: async () => {
        const accounts = await window.web3.eth.getAccounts();
        App.account = accounts[0];
        $('#account').text(App.account);
        const balance = await window.web3.eth.getBalance(App.account);
        $('#accountBalance').text(window.web3.utils.fromWei(balance, "ether") + " ETH");
    },

    initContract: async () => {
        $.getJSON('ChainList.json', chainListArtifact => {
            App.contracts.ChainList = TruffleContract(chainListArtifact);
            App.contracts.ChainList.setProvider(window.web3.currentProvider);
            App.listenToEvents();
            return App.reloadArticles();
        });
    },

    // Listen to events raised from the contract
    listenToEvents: async () => {
        const chainListInstance = await App.contracts.ChainList.deployed();
        if(App.logSellArticleEventListener == null) {
            App.logSellArticleEventListener = chainListInstance
                .LogSellArticle({fromBlock: '0'})
                .on("data", event => {
                    $('#' + event.id).remove();
                    $('#events').append('<li class="list-group-item" id="' + event.id + '">' + event.returnValues._name + ' is for sale</li>');
                    App.reloadArticles();
                })
                .on("error", error => {
                    console.error(error);
                });
        }
        if(App.logBuyArticleEventListener == null) {
            App.logBuyArticleEventListener = chainListInstance
                .LogBuyArticle({fromBlock: '0'})
                .on("data", event => {
                    $('#' + event.id).remove();
                    $('#events').append('<li class="list-group-item" id="' + event.id + '">' + event.returnValues._buyer + ' bought ' + event.returnValues._name + '</li>');
                    App.reloadArticles();
                })
                .on("error", error => {
                    console.error(error);
                });
        }

        $('.btn-subscribe').hide();
        $('.btn-unsubscribe').show();
        $('.btn-show-events').show();
    },

    stopListeningToEvents: async () => {
        if(App.logSellArticleEventListener != null) {
            console.log("unsubscribe from sell events");
            await App.logSellArticleEventListener.removeAllListeners();
            App.logSellArticleEventListener = null;
        }
        if(App.logBuyArticleEventListener != null) {
            console.log("unsubscribe from buy events");
            await App.logBuyArticleEventListener.removeAllListeners();
            App.logBuyArticleEventListener = null;
        }

        $('#events')[0].className = "list-group-collapse";

        $('.btn-subscribe').show();
        $('.btn-unsubscribe').hide();
        $('.btn-show-events').hide();
    },

    sellArticle: async () => {
        const articlePriceValue = parseFloat($('#article_price').val());
        const articlePrice = isNaN(articlePriceValue) ? "0" : articlePriceValue.toString();
        const _name = $('#article_name').val();
        const _description = $('#article_description').val();
        const _price = window.web3.utils.toWei(articlePrice, "ether");
        if(_name.trim() == "" || _price === "0") {
            return false;
        }
        try {
            const chainListInstance = await App.contracts.ChainList.deployed();
            const transactionReceipt = await chainListInstance.sellArticle(
                _name,
                _description,
                _price,
                {from: App.account, gas: 5000000}
            ).on("transactionHash", hash => {
                console.log("transaction hash", hash);
            });
            console.log("transaction receipt", transactionReceipt);
        } catch(error) {
            console.error(error);
        }
    },

    buyArticle: async () => {
        event.preventDefault();

        // retrieve the article price
        var _articleId = $(event.target).data('id');
        const articlePriceValue = parseFloat($(event.target).data('value'));
        const articlePrice = isNaN(articlePriceValue) ? "0" : articlePriceValue.toString();
        const _price = window.web3.utils.toWei(articlePrice, "ether");
        try {
            const chainListInstance = await App.contracts.ChainList.deployed();
            const transactionReceipt = await chainListInstance.buyArticle(
                _articleId, {
                    from: App.account,
                    value: _price,
                    gas: 500000
                }
            ).on("transactionHash", hash => {
                console.log("transaction hash", hash);
            });
            console.log("transaction receipt", transactionReceipt);
        } catch(error) {
            console.error(error);
        }
    },

    reloadArticles: async () => {
        // avoid reentry
        if (App.loading) {
            return;
        }
        App.loading = true;

        // refresh account information because the balance may have changed
        App.displayAccountInfo();

        try {
            const chainListInstance = await App.contracts.ChainList.deployed();
            const articleIds = await chainListInstance.getArticlesForSale();
            $('#articlesRow').empty();
            for(let i = 0; i < articleIds.length; i++) {
                const article = await chainListInstance.articles(articleIds[i]);
                App.displayArticle(article[0], article[2], article[3], article[4], article[5]);
            }
            App.loading = false;
        } catch(error) {
            console.error(error);
            App.loading = false;
        }
    },

    displayArticle: (seller, name, description, price, id) => {
        // Retrieve the article placeholder
        const articlesRow = $('#articlesRow');
        const etherPrice = web3.utils.fromWei(price, "ether");

        // Retrieve and fill the article template
        var articleTemplate = $('#articleTemplate');
        articleTemplate.find('.panel-title').text(name);
        articleTemplate.find('.article-description').text(description);
        articleTemplate.find('.article-price').text(etherPrice + " ETH");
        articleTemplate.find('.btn-buy').attr('data-id', id);
        articleTemplate.find('.btn-buy').attr('data-value', etherPrice);

        // seller?
        if (seller == App.account) {
            articleTemplate.find('.article-seller').text("You");
            articleTemplate.find('.btn-buy').hide();
        } else {
            articleTemplate.find('.article-seller').text(seller);
            articleTemplate.find('.btn-buy').show();
        }

        // add this new article
        articlesRow.append(articleTemplate.html());
    },

    

    
};

$(function () {
    $(window).load(function () {
        App.init();
    });
});
