/*!
    @preserve

    ATON Trace/Record visualization
    depends on ATON.core

 	@author Bruno Fanini
	VHLab, CNR ITABC

==================================================================================*/

ATON.tracer = {};

ATON.tracer.resPath = "res/";
ATON.tracer.rootRecordFolder = "record/";

ATON.tracer.CSV_DELIMITER = ',';
ATON.tracer.fileRecordReq = 0;
ATON.tracer.discardSQfocusMin = 0.002;
ATON.tracer.discardSQfocusMax = 200.0; //0.5;


ATON.tracer._groupVRC = undefined;
ATON.tracer._uMarkModels = [];
ATON.tracer._uSessions   = [];
ATON.tracer.tRange = [undefined, undefined];



ATON.tracer._touchVRCgroup = function(){
    if (ATON.tracer._groupVRC) return;

    ATON.tracer._groupVRC = new osg.Node();

    ATON.tracer._groupVRC.getOrCreateStateSet().setBinNumber(16);
    ATON.tracer._groupVRC.getOrCreateStateSet().setRenderingHint('TRANSPARENT_BIN');

    ATON.tracer._groupVRC.getOrCreateStateSet().setAttributeAndModes(
        //new osg.BlendFunc(osg.BlendFunc.SRC_ALPHA, osg.BlendFunc.ONE_MINUS_SRC_ALPHA), 
        new osg.BlendFunc(osg.BlendFunc.SRC_ALPHA, osg.BlendFunc.ONE_MINUS_SRC_ALPHA), 
        osg.StateAttribute.ON | osg.StateAttribute.OVERRIDE
        );

    //var D = new osg.Depth( osg.Depth.LESS );
    //D.setRange(0.0, 1.0);
    //ATON.tracer._groupVRC.getOrCreateStateSet().setAttributeAndModes( D );

    ATON._groupUI.addChild( ATON.tracer._groupVRC );
};

ATON.tracer.filter = function(tper, trad){
    if (ATON.tracer._groupVRC === undefined) return;

    var tpivot = ATON.tracer.tRange[0] + tper*(ATON.tracer.tRange[1] - ATON.tracer.tRange[0]);

    tmin = tpivot - trad;
    tmax = tpivot + trad;

    //console.log("tPivot: "+tpivot);
    var tminutes = Math.floor(tpivot / 60);
    var tseconds = tpivot - (tminutes * 60);


    $('#idT').html(parseInt(tminutes) + "\' " + parseInt(tseconds) + "\'\'");
    $('#idTR').html(trad.toFixed(1) + " seconds");

    for (let s = 0; s < ATON.tracer._uSessions.length; s++) {
        var us = ATON.tracer._uSessions[s];
        if (us){
            var uid = parseInt(us.getName());
            //console.log("UID: "+uid);
            for (let at = 0; at < us.getChildren().length; at++) {
                var mark = us.getChild(at);
                
                tmark = parseFloat(mark.getName());

                if (tmark > tmin && tmark <tmax) mark.setNodeMask(0xf);
                else mark.setNodeMask(0x0);
                }
            }
        
    }
};

// HTML ui
ATON.tracer.filterUI = function(){
    var t  = parseFloat($("#uSessionTime").val());
    var tr = parseFloat($("#uSessionTRad").val());

    ATON.tracer.filter(t,tr);
};


// Load single user recorded trace
ATON.tracer.loadUserRecord = function(scenename, uid){
    ATON.tracer._touchVRCgroup();

    // This will host our user session
    var uSession = new osg.Node();
    uSession.setName(uid);
    ATON.tracer._groupVRC.addChild( uSession );
    
    ATON.tracer._uSessions.push(uSession);


    path = ATON.tracer.rootRecordFolder + scenename+ "/U"+uid+".csv";

    ATON.tracer.fileRecordReq++;
    console.log("[R] LOADING "+path+"....");

    $.get( path, function(data){
        var lines = data.split("\n");

        var bHeader = true;
        var attrNames = [];

        var pos = osg.vec3.create();
        var foc = osg.vec3.create();
        var ori = osg.quat.create();

        var prevfoc = osg.vec3.create();
        var prevpos = osg.vec3.create();

        var t = undefined;

        // For each row
        $.each(lines, function(n, elem){
            var values = elem.split(ATON.tracer.CSV_DELIMITER);

            // For each column
            var numCols = values.length;
            for (var i = 0; i < numCols; i++){
                var currVal = values[i].trim();

                // Header row
                if (bHeader) attrNames.push( currVal );
                else {
                    if (attrNames[i] === 'Time' && currVal.length>0) t = parseFloat(currVal);

                    if (attrNames[i] === 'px' && currVal.length>0) pos[0] = parseFloat(currVal);
                    if (attrNames[i] === 'py' && currVal.length>0) pos[1] = parseFloat(currVal);
                    if (attrNames[i] === 'pz' && currVal.length>0) pos[2] = parseFloat(currVal);

                    if (attrNames[i] === 'fx' && currVal.length>0) foc[0] = parseFloat(currVal);
                    if (attrNames[i] === 'fy' && currVal.length>0) foc[1] = parseFloat(currVal);
                    if (attrNames[i] === 'fz' && currVal.length>0) foc[2] = parseFloat(currVal);

                    if (attrNames[i] === 'ox' && currVal.length>0) ori[0] = parseFloat(currVal);
                    if (attrNames[i] === 'oy' && currVal.length>0) ori[1] = parseFloat(currVal);
                    if (attrNames[i] === 'oz' && currVal.length>0) ori[2] = parseFloat(currVal);
                    if (attrNames[i] === 'ow' && currVal.length>0) ori[3] = parseFloat(currVal);
                    }

                }

            // The whole row is parsed at this point, add mark
            if (!bHeader){
                // Update temporal ranges
                if (ATON.tracer.tRange[0] === undefined || t < ATON.tracer.tRange[0]) ATON.tracer.tRange[0] = t;
                if (ATON.tracer.tRange[1] === undefined || t > ATON.tracer.tRange[1]) ATON.tracer.tRange[1] = t;

                var dFoc = osg.vec3.squaredDistance(foc, prevfoc);
                if (dFoc >= ATON.tracer.discardSQfocusMax){
                    prevfoc[0] = foc[0];
                    prevfoc[1] = foc[1];
                    prevfoc[2] = foc[2];
                    }

                if (dFoc > ATON.tracer.discardSQfocusMin && dFoc < ATON.tracer.discardSQfocusMax){
                    //var at = new osg.MatrixTransform();
                    //osg.mat4.fromRotationTranslation(at.getMatrix(), ori, foc);

                    var at = new osg.AutoTransform();
                    
                    at.setName(t); // timestamp

                    at.setPosition([foc[0],foc[1],foc[2],0]);
                    at.setAutoRotateToScreen(true);
                    //at.setAutoScaleToScreen(true);

                    // First time
                    if (ATON.tracer._uMarkModels[uid] === undefined){
                        var size = 1.5; //200.0;

                        ATON.tracer._uMarkModels[uid] = osg.createTexturedQuadGeometry(
                            -(size*0.5), -(size*0.5), 0.0,   // corner
                            size, 0, 0.0,                    // width
                            0, size, 0.0 );                  // height

                        osgDB.readImageURL(ATON.tracer.resPath+"assets/mark"+uid+".png").then( function ( data ){
                            var bgTex = new osg.Texture();
                            bgTex.setImage( data );
                    
                            bgTex.setMinFilter( osg.Texture.LINEAR_MIPMAP_LINEAR ); // LINEAR_MIPMAP_LINEAR // osg.Texture.LINEAR
                            bgTex.setMagFilter( osg.Texture.LINEAR ); // osg.Texture.LINEAR
                            
                            bgTex.setWrapS( osg.Texture.CLAMP_TO_EDGE );
                            bgTex.setWrapT( osg.Texture.CLAMP_TO_EDGE );
                    
                            ATON.tracer._uMarkModels[uid].getOrCreateStateSet().setTextureAttributeAndModes(0, bgTex);
                            console.log("User"+uid+" mark texture loaded");
                            });
                        }

                    at.addChild( ATON.tracer._uMarkModels[uid] );
                    uSession.addChild( at );
                    
                    prevfoc[0] = foc[0];
                    prevfoc[1] = foc[1];
                    prevfoc[2] = foc[2];
                    //console.log(x,y,z);
                    }
                }

            bHeader = false;
            });

        ATON.tracer.fileRecordReq--;
        if (ATON.tracer.fileRecordReq <= 0) ATON.tracer._onAllFileRequestsCompleted();
        });
};


ATON.tracer._onAllFileRequestsCompleted = function(){
    console.log("All record files loading COMPLETE!");
    console.log(ATON.tracer.tRange);

    //ATON.tracer.filter(0.8, 0.3);
};