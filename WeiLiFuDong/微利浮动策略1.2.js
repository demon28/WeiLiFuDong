//账户信息
var InitAccount = null;

//盈利或亏损
var Profit = 0;
//当前持仓是多仓 还是 空仓，PD_LONG代表多仓，PD_SHORT代表空仓
var Type = "0";
//当前持仓均价
var Price = 0;
//当前持仓数量
var Amount = 0;

//趋势开仓方向
var OpenWay = "PD_LONG";

//持仓信息
var Position;

//总计盈亏
var Count = 0;

//取消所有挂单
function CancelPendingOrders() {

    while (true) {
        var orders = exchange.GetOrders()
        for (var i = 0; i < orders.length; i++) {
            exchange.CancelOrder(orders[i].Id, "清空所有所有挂单");
            Sleep(500)
        }
        if (orders.length === 0) {
            break
        }
    }
}


function OpenOrder() {

    //张数*10元美金/币价/倍数=保证金

    //设定开仓方向：0代表空仓，1代表多仓
    if (OpenWay == "PD_LONG") {
        exchange.SetDirection("buy");
        var tickprice = _C(exchange.GetTicker).Sell + Slippage_Open_Long; //做多的话价格卖一价高一点


        exchange.Buy(tickprice, Blance);   //买入开多
        Log("开仓做多:" + tickprice);

    } else {

        exchange.SetDirection("sell");
        var tickprice = _C(exchange.GetTicker).Buy + Slippage_Open_Short; //做多的话价格买一价低一点

        exchange.Sell(tickprice, Blance);   //卖出开空
        Log("开仓做空:" + tickprice);
    }
    Sleep(open_wait);
    CancelPendingOrders();  //成交不了则取消所有订单

}

//做多平仓
function CloseLong() {


    Position = exchange.GetPosition();

    //盈利比 ：当前Ticket卖一价 减去 持仓均价 除以 持仓均价
    var win_ratio = (_C(exchange.GetTicker).Sell - Price) / Price;

    //亏损比 ：持仓均价 减去 当前Ticket卖一价 除以 持仓均价
    var loss_ratio = (Price - _C(exchange.GetTicker).Sell) / Price;

    Log("CloseLong盈利比：" + win_ratio + "======" + "亏损比：" + loss_ratio + "#FF00FF");

    //是否止盈 
    if (win_ratio >= profit) {

        exchange.SetDirection("closebuy");
        var tickPrice = _C(exchange.GetTicker).Buy + Slippage_Close_Long;  //滑价：做多比市场价便宜一点，卖出  吃单手续费太高

        exchange.Sell(tickPrice, Position[0].Amount);  //卖出平多
        OpenWay = Long_Win_Font;   //赚了就继续这个方向开多 或者反方向开

        Log("卖出平多 单价：" + tickPrice + " 止盈：" + Position[0].Profit + "   平仓量：" + Position[0].Amount + " #00FF00");

        Sleep(close_wait);
        CancelPendingOrders();  //成交不了则取消所有订单


    }

    //是否止损
    if (loss_ratio >= loss) {


        exchange.SetDirection("closebuy");
        var tickPrice = _C(exchange.GetTicker).Buy + Slippage_Close_Long;   //吃单手续费万3，加高一点变成挂单手续费只有万1

        exchange.Sell(tickPrice, Position[0].Amount); //卖出平多
        OpenWay = Long_Loss_Font;   //亏了就继续这个方向开多 或者反方向开

        Log("卖出平多 单价：" + tickPrice + "  止损：" + Position[0].Profit + "   平仓量：" + Position[0].Amount + " #FF0000");

        Sleep(close_wait);
        CancelPendingOrders();  //成交不了则取消所有订单

    }


}

//做空平仓
function CloseShort() {

    Position = exchange.GetPosition();

    //盈利比 ：持仓均价 减去 当前Ticket买一价 除以 持仓均价
    var win_ratio = (Price - _C(exchange.GetTicker).Buy) / Price;

    //亏损比 ：当前Ticket买一价 减去 持仓均价 除以 持仓均价
    var loss_ratio = (_C(exchange.GetTicker).Buy - Price) / Price;

    Log("CloseShort盈利比：" + win_ratio + "======" + "亏损比：" + loss_ratio + "#FF00FF");

    //是否止盈 
    if (win_ratio >= profit) {

        exchange.SetDirection("closesell");
        var tickPrice = _C(exchange.GetTicker).Sell + Slippage_Close_Short;   //滑价：做空比市场买一价高一点 买入


        exchange.Buy(tickPrice, Position[0].Amount);  //买入平空
        OpenWay = Short_Win_Font;   //赚了就继续这个方向开多

        Log("买入平空 单价：" + tickPrice + "  止盈：" + Position[0].Profit + "   平仓量：" + Position[0].Amount + " #00FF00");


        Sleep(close_wait);
        CancelPendingOrders();  //成交不了则取消所有订单
    }

    //是否止损
    if (loss_ratio >= loss) {

        exchange.SetDirection("closesell");
        var tickPrice = _C(exchange.GetTicker).Sell + Slippage_Close_Short;
        exchange.Buy(tickPrice, Position[0].Amount);  //买入平空

        OpenWay = Short_Loss_Font;   //亏了则下次开仓为反方向 开空

        Log("买入平空 单价：" + tickPrice + "  止损：" + Position[0].Profit + "   平仓量：" + Position[0].Amount + " #FF0000");



        Sleep(close_wait);
        CancelPendingOrders();  //成交不了则取消所有订单
    }



}


//入口方法
function main() {
    //设置季度合约， this_week:当周   next_week:下周   quarter:季度
    exchange.SetContractType("this_week");

    //设置20倍杠杆
    exchange.SetMarginLevel(20);



    //判读是否有持仓
    if (exchange.GetPosition().length > 0) {
        throw "策略启动前不能有持仓."
    }


    //取消所有挂单
    CancelPendingOrders();
    InitAccount = exchange.GetAccount();
    InitAccount_json = JSON.parse(exchange.GetRawJSON());




    //设定初始开仓方向
    OpenWay = isopen == 1 ? "PD_LONG" : "PD_SHORT";

    //清空所有日志
    LogProfitReset();

    while (true) {
        onTick();
        Sleep(500);
    }
}

//循环执行
function onTick() {
    //1.判断有没有持仓,没持仓则开仓
    //A，多仓需要比市价低一点
    //B, 空仓需要比市价高一点
    //C, 500毫秒钟开不到仓，取消挂单
    //2.判断平仓条件
    //A.判读多仓或空仓的盈亏是否 达到平仓条件
    //B.达到平仓条件则平仓，若盈利则继续该方向开仓若亏损则反方向开仓

    Position = exchange.GetPosition();

    //如果没有持仓，则开仓
    if (Position.length <= 0) {
        Log("没有持仓，开仓：" + OpenWay);
        OpenOrder();
    }

    //确定有持仓
    if (Position.length > 0) {

        Profit = Position[0].Profit;
        Price = Position[0].Price;
        Amount = Position[0].Amount;
        Type = Position[0].Type;
        var Type_Value = Type == "0" ? "多仓" : "空仓";

        Log("当前持仓[" + Type_Value + "]，持仓均价：" + Price + "====当前币价：" + exchange.GetTicker().Last + "===" + "持仓数量：" + Amount + "===" + "持仓盈亏：" + Profit + "  #0000FF");

        //做多
        if (Type == "0") {
            CloseLong();
        }

        //做空
        if (Type == "1") {
            CloseShort();
        }

    }

    exchange.GetAccount();
    var objnow;
    var objinit;
    if (CoinType == "eos") {
        objnow = JSON.parse(exchange.GetRawJSON()).info.eos;
        objinit = InitAccount_json.info.eos;
    }
    if (CoinType == "eth") {
        objnow = JSON.parse(exchange.GetRawJSON()).info.eth;
        objinit = InitAccount_json.info.eth;
    }

    if (objnow != null) {
        Log("初始_可用余额：" + objinit.balance + "    初始_总余额：" + objinit.rights);
        Log("当前_可用余额：" + objnow.balance + "    当前_总余额：" + objnow.rights);
        var winamount = objnow.rights - objinit.rights;
        LogProfit(winamount, "盈利情况：" + winamount);
    }



    Sleep(interval);

}