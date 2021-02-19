const webdriver = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const {Builder, By, Key, until, Capabilities} = require('selenium-webdriver');
const Algorithm = require('./alg.js')

var options = new chrome.Options()
options.addArguments("--autoplay-policy=no-user-gesture-required")
options.windowSize({height:5, width:5, x:0, y:0});
var driver = new webdriver.Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

//driver.manage().window().setRect({height:5, width:5, x:0, y:0});

const num = 3;
const alg = new Algorithm(num);
class SeleniumTest{

    constructor(){
        this.timeouts = null;
        this.first = 0;
//        this.num = 3; // number of sounds in personalized sound library.
        this.timer = 60000; // Each sound is played up to 10 seconds.
        this.msg = null;
        this.select_msg = null;
        this.bpms = [];
        this.avg_bpm = 0;
        //await this.init();
    }


close(){
    var self = this;
    //console.log('exiting...');
    driver.quit().then((e)=>{
        process.exit();
    });
}

pause() {

}

addBPM(bpm){
    //console.log(this.bpms)
    this.bpms.push(bpm);
}

restBPM(restbpm){
    console.log("resting heart rate:", restbpm);
    alg.setRestBPM(restbpm);
}

select(mode, pressed){
    /*
        Select the next soundscape.
    */
    //return index
    var sum = 0;
    for (var i = this.bpms.length - 1; i >= 0; i--) {
        sum += parseFloat(this.bpms[i]);
    }
    var avg = sum / this.bpms.length
    //console.log(Date.now(),"average", avg);
    this.avg_bpm = avg;
    var idx = alg.generateNext(avg, mode, pressed); //generate reward from averaged bpm
    this.select_msg = alg.getMessage();
    this.bpms = [];
    return idx; // randomly generated.
}

async startFirstSound(){
    /*
        Play the first soundscape.
    */
    var self = this;
    var msg = driver.findElement(By.css('body')).then(async (el)=>{
        el.sendKeys(Key.chord("p")).then((a)=>{
            //console.log("unmute...");
        }).catch((e) => { console.error(e.message) });
        return await driver.findElement(By.css('div.bigTitle')).then(async (ele)=>{
            return await ele.getText().then((e)=>{
                return e;
            });
        });
    }).catch((e) => { console.error(e.message) });
    var sum = 0;
    for (var i = self.bpms.length - 1; i >= 0; i--) {
        sum += parseFloat(self.bpms[i]);
    }
    self.avg_bpm = sum / self.bpms.length
    return msg.then((e)=>{
        return [e,"; soundscape: "+ e + "; soundscape index: "+(num-1).toString()+ "; heart_rate: " + self.avg_bpm.toString()]
    })
}

async playNext(mode, pressed){
    /*
        1. Mute currently playing soundscape.
        2. Select the next soundscape by calling select().
        3. Switch the window to the next tab.
        4. Unmute the soundscape.
    */
    var self = this;
    var msg = driver.findElement(By.css('body')).then((el)=>{
        // mute currently playing soundscape
        return el.sendKeys(Key.chord("p")).then(async function(a) {
            //console.log("mute...");
            // determine the next soundscape
            let ind = self.select(mode, pressed);
            // switch tab
            var windows = await driver.getAllWindowHandles().then((value)=>{return value});
            await driver.switchTo().window(windows[ind+1]);
            //await self.sleep(1000);
            var m = await driver.findElement(By.css('body')).then(async function(el){
                // unmute next soundscape
                await el.sendKeys(Key.chord("p")).then((a)=>{
                    //console.log("unmute...");
                });
                return await driver.findElement(By.css('div.bigTitle')).then(async function (el){
                   return await el.getText().then((value)=>{
                        //console.log("Switched to "+value);
                        //el.getDriver().getWindowHandle().then((va)=>{console.log(va);});
                        return value;
                    });
                });
            });
            return [m, ind];
        });
    });
    return msg.then((e)=>{
        return [e[0],"; soundscape: "+e[0] + "; soundscape index: "+e[1]+ "; heart_rate: " + self.avg_bpm.toString() + self.select_msg]
    })
}

sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async init(){
    /*
        1. Initialize the chromedriver.
        2. Find all listed sound categories.
        3. Select a part of categories.
        4. Initialize the browser and all tabs, load all sounds.
    */
    var SELENIUM_REMOTE_URL = "https://mynoise.net/noiseMachines.php";
    var allSounds = [];
    // Initialize the driver.
    driver.get(SELENIUM_REMOTE_URL);

    // Look for all sound categories.
    // Sound categories are stored in parameter 'allSounds'.
    var elems = await driver.findElements(By.css('span.DIM'));
    for (var i = 0; i < elems.length; i++) {
        let comb = [];
        await elems[i].getAttribute("class").then(function(value){
            comb.push(value.split(' ')[1]);
        });
        await elems[i].findElement(By.xpath(".//a")).then(function(el){
            el.getAttribute("href").then(function(value){
                comb.push(value);
            });
        });
        allSounds.push(comb);
    }

    // Select sounds.
    var lib = this.getLibrary(allSounds);

    //Open all tabs and wait until all sounds are loaded.
    await this.openTabs(lib);
    return true;
}

getLibrary(allSounds){
    /*
        Select a subset of sound categories.
    */
    let ret = [];
    let count = 0;
    for (var i = 0; i < allSounds.length; i++) {
        // Sounds are randomly selected.
        if (Math.random() > 0.5 && count < num) {
            ret.push(allSounds[i]);
            count += 1;
        }
    }
    return ret;
}

async openTabs(lib){
    /*
        1. Open all tabs.
        2. Switch the chromedriver to each tab for loading sounds.
        3. For each tab,
            if the autoplay of audiocontext is disabled:
                a. Wait until the 'play' button is displayed in 'div.contextPlay'.
                b. Click the 'play' button to enable the audiocontext.
                c. Send key 'm' to mute the sound.
            if the autoplay of audiocontext is enabled:
                a. Wait until the 'mute' button is pointer-interactive.
                b. Send key 'm' to mute the sound.
    */
    for (var i = 0; i < lib.length; i++) {
        await driver.executeScript("window.open('"+lib[i][1]+"', '"+i+"');", );
    }
    var windows = await driver.getAllWindowHandles();
    //console.log(windows);
    for (var i = 0; i < windows.length-1; i++) {
        await driver.switchTo().window(windows[i+1]);
        let processed = false;
        //console.log(i,windows[i+1]);
        //driver.getWindowHandle().then((va)=>{console.log(va);});
        //var p1 = driver.wait(until.elementIsVisible(driver.findElement(By.css('div.contextPla'))), 100000);
        var p2 = driver.wait(function(){
            return driver.findElement(By.id('mute')).then((elem1)=>{
                return elem1.getAttribute("class").then(async function(classes){
                    if (classes.indexOf('active') < 0 && classes.indexOf('disabled') < 0 && !processed) {
                        
                        return elem1;
                    }
                });
            })
        }, 100000);
        //var p2 = driver.wait(until.elementTextContains(driver.findElement(By.id('msg')),'Playing'),100000);
        await p2.then(async function(ele){
            processed = true;
            let value = await ele.getAttribute("class").then((value)=>{return value});
            //console.log(value);
            /*
            if (value == 'contextPlay') {
                await ele.click().then((e)=>{console.log("clicked")}).catch((e)=>{console.error(e.message);});
            }*/
            ele.getDriver().getWindowHandle().then((va)=>{});
            await driver.findElement(By.css('body')).then(async function(bd){
                //driver.getTitle().then((e)=>console.log(e))
                await bd.sendKeys(Key.chord("p")).then((a)=>{
                    console.log("loading..."+((i+1)/num).toFixed(2)*100+"%.");
                }).catch((e)=>{console.error(e.message);});
            }).catch((e)=>{console.error(e.message);});
            
        });
        /*
        await Promise.any([p1, p2]).then(async function(ele) {
            processed = true;
            let value = await ele.getAttribute("class").then((value)=>{return value});
            console.log(value);
            if (value == 'contextPlay') {
                await ele.click().then((e)=>{console.log("clicked")}).catch((e)=>{console.error(e.message);});
            }
            ele.getDriver().getWindowHandle().then((va)=>{console.log(va);});
            await driver.findElement(By.css('body')).then(async function(bd){
                //driver.getTitle().then((e)=>console.log(e))
                await bd.sendKeys(Key.chord("p")).then((a)=>{
                    console.log("loading..."+((i+1)/num).toFixed(2)*100+"%.");
                }).catch((e)=>{console.error(e.message);});
            }).catch((e)=>{console.error(e.message);});
            
        });*/
    }
    //this.msg = "Press ENTER to start.\nPress 'n' to switch soundscape manually.\nPress CTRL+'c' to exit the program."

    //document.getElementById("msg").innerHTML = s;
    //console.log("Press ENTER to start.");
    //console.log("Press 'n' to switch soundscape manually.");
    //console.log("Press CTRL+'c' to exit the program.");

}




}
module.exports = SeleniumTest
