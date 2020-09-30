/*
    ATON Front-end blueprint

    author: bruno.fanini_AT_gmail.com

===========================================================*/

/**
ATON Front-end routines
@namespace FE
*/
let FE = {};


FE.realize = ()=>{
    FE.PATH_RES_ICONS = ATON.PATH_RES+"icons/";

    FE._bPopup = false; // showing popup
    FE.bPopupBlurBG = 0.25; // blur 3D content on popup show, 0.0 to disable

    FE.urlParams = new URLSearchParams(window.location.search);

    FE._uiSetupBase();

    ATON.realize();
};

// Add basic spinning loader
FE.addBasicLoaderEvents = ()=>{
    ATON.on("NodeRequestFired", ()=>{ $("#idLoader").show(); });
    ATON.on("AllNodeRequestsCompleted", ()=>{ 
        $("#idLoader").hide();
        
        if (ATON.Nav.homePOV === undefined) ATON.Nav.computeAndRequestDefaultHome(0.5);
    });
};

FE.loadSceneID = (sid)=>{
    if (sid === undefined) return;

    let reqstr = ATON.PATH_RESTAPI_SCENE + sid;
    if (ATON.SceneHub._bEdit) reqstr += ",edit";

    ATON.SceneHub.load(reqstr, sid);
    console.log(reqstr);
};



// HTML UI
//=======================================
// Sample basic UI setup
FE.uiBasicSetup = ()=>{
    FE.uiAddButton("idTopToolbar","fullscreen", ATON.toggleFullScreen );
    if (ATON.Utils.isConnectionSecure()) FE.uiAddButton("idTopToolbar","vr", ATON.XR.toggle );

    FE.uiAddButton("idBottomToolbar","home", ()=>{ ATON.Nav.requestHome(0.1); });
};

FE._uiSetupBase = ()=>{
    $("#idPopup").click( FE.popupClose );
    $("#idLoader").html("<img src='"+ATON.PATH_RES+"loader.png'>");
};

// Add Generic button to a specific div container
FE.uiAddButton = (idcontainer, iconid, onPress)=>{
    let htmlcode = "<button id='btn-"+iconid+"' type='button' class='atonBTN'><img src='"+FE.PATH_RES_ICONS+iconid+".png'></button>";
    $("#"+idcontainer).append(htmlcode);

    if (onPress) $("#btn-"+iconid).click( onPress );
};

FE.uiSwitchButton = (iconid, b)=>{
    if (b) $("#btn-"+iconid).addClass("switchedON");
    else $("#btn-"+iconid).removeClass("switchedON");
};

FE.uiAddButtonHome = (idcontainer)=>{
    FE.uiAddButton(idcontainer, "home", ()=>{ 
        ATON.Nav.requestHome(0.3);
    });
};

FE.uiAddButtonFirstPerson = (idcontainer)=>{
    FE.uiAddButton(idcontainer, "fp", ()=>{
        if (ATON.Nav.isFirstPerson()){
            ATON.Nav.setOrbitControl();
            FE.uiSwitchButton("fp",false);
        }
        else {
            ATON.Nav.setFirstPersonControl();
            FE.uiSwitchButton("fp",true);
        }
    });
};
FE.uiAddButtonVR = (idcontainer)=>{
    if (!ATON.Utils.isConnectionSecure()) return;
    FE.uiAddButton(idcontainer, "vr", ATON.XR.toggle );
};
FE.uiAddButtonDeviceOrientation = (idcontainer)=>{
    if (!ATON.Utils.isConnectionSecure()) return;
    if (!ATON.Utils.isMobile()) return;

    FE.uiAddButton(idcontainer,"devori", ()=>{
        if (ATON.Nav.isDevOri()){
            ATON.Nav.setOrbitControl();
            FE.uiSwitchButton("devori",false);
        }
        else {
            ATON.Nav.setDeviceOrientationControl();
            FE.uiSwitchButton("devori",true);
        }
    });
};

FE.uiAddButtonQR = (idcontainer)=>{
    FE.uiAddButton(idcontainer,"qr", FE.popupQR );
};

FE.uiAddButtonFullScreen = (idcontainer)=>{
    FE.uiAddButton(idcontainer, "fullscreen", ()=>{
        ATON.toggleFullScreen();
        screenfull.isFullscreen? FE.uiSwitchButton("fullscreen",false) : FE.uiSwitchButton("fullscreen",true);
    });
};

FE.uiAddButtonVRC = (idcontainer)=>{
    FE.uiAddButton(idcontainer, "vrc", ()=>{
        //TODO:
    });
};

// Attach ID validator to given input field
FE.uiAttachInputFilterID = (inputid)=>{
    $("#"+inputid).on('keyup change input', ()=>{
        let value = $("#"+inputid).val();
        let regReplace = new RegExp('[^A-Za-z-_]', 'ig');
        $("#"+inputid).val( value.replace(regReplace, '') );

    });
};

FE.setupBasicUISounds = ()=>{
    FE.auLib = {};

    FE.auLib.switch = new Audio(ATON.PATH_RES+"audio/switch.wav");
    FE.auLib.switch.loop = false;
};


// Popups
//===================================================================
FE.popupShow = (htmlcontent)=>{
    if (FE._bPopup) return false;

    $('#idPopup').html("<div class='atonPopup' id='idPopupContent'>"+htmlcontent+"</div>");
    $('#idPopupContent').click((e)=>{ e.stopPropagation(); });
    $('#idPopup').fadeIn();

    FE._bPopup = true;

    if (FE.bPopupBlurBG > 0.0){
        ATON._renderer.setPixelRatio( FE.bPopupBlurBG );
        ATON._renderer.render( ATON._mainRoot, ATON.Nav._camera );
    }

    ATON._bPauseQuery = true;
    //ATON.renderPause();
    return true;
};

FE.popupClose = ()=>{
    FE._bPopup = false;

    //ATON.renderResume();
    if (FE.bPopupBlurBG > 0.0) ATON.resetPixelDensity();

    $("#idPopup").fadeOut();
    //$("#idPopup").empty();

    ATON._bPauseQuery = false;
    ATON.focusOn3DView();
};

FE.popupQR = ()=>{
    let htmlcontent = "<h1>Share</h1>";
    htmlcontent += "<div class='atonQRcontainer' id='idQRcode'></div><br><br>";

    if ( !ATON.FE.popupShow(htmlcontent) ) return;

    let url = window.location.href;
    new QRCode(document.getElementById("idQRcode"), url);
};



export default FE;