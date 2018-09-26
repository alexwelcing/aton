/*!
    @preserve

    ATON VRoadcast Client
    depends on ATON.core

 	@author Bruno Fanini
	VHLab, CNR ITABC

==================================================================================*/

ATON.vroadcast = {};

ATON.vroadcast.resPath = "res/";

ATON.vroadcast.socket     = undefined;
ATON.vroadcast.connected  = false;
ATON.vroadcast.uStateFreq = 0.1;

// custom events
ATON.vroadcast.onIDassigned = undefined;
ATON.vroadcast.onDisconnect = undefined;


ATON.vroadcast.users      = [];
ATON.vroadcast.manip      = undefined;

/*
ATON.vroadcast = {
    users: [],
    socket: undefined,
    connected: false,
    manip: undefined,
    uStateFreq: 0.1,
};
*/

ATON.vroadcast.onUserEnter = function(){
    ATON.vroadcast._audioLibEnter.play();
};
ATON.vroadcast.onUserLeave = function(){

};
ATON.vroadcast.onUserMSG = function(){
    ATON.vroadcast._audioLibMSG.play();
};

// Def users colors
ATON.vroadcast.UCOLORS = [
    [1,0.5,0.5, 1.0],
    [1,1,0.5, 1.0],
    [0.5,1,0.5, 1.0],
    [0.5,1,1, 1.0],
    [0.5,0.5,1, 1.0],
    [1,0.5,1, 1.0],
];


// User
ATON.user = function(){
    this.id = -1;
    this.username = "";
    this.status   = "...";
    this.weight   = 0.0; // old
    this.radius   = 30.0;
    this.rank     = 0;

    // Only for my user
    this.lastPos = osg.vec3.create();
    this.lastOri = osg.quat.create();

    // Only for other users
    this._mt = undefined;
    this._focAT = undefined;
    
    this.magNode = undefined;

    this.target = osg.vec3.create();
};

ATON.user.prototype = {
    // todo
};

ATON.vroadcast.setupResPath = function(path){
    ATON.vroadcast.resPath = path;

    // Interface audio/sounds
    ATON.vroadcast._audioLibEnter = new Audio(path+"audio/alert1.mp3");
    ATON.vroadcast._audioLibEnter.loop = false;
    ATON.vroadcast._audioLibMSG = new Audio(path+"audio/pling.mp3");
    ATON.vroadcast._audioLibMSG.loop = false;
};


ATON.vroadcast.connect = function(address, scene){

    if (scene !== undefined) ATON.vroadcast._scene = scene;
    else ATON.vroadcast._scene = "_SHARED_";

    if (address === undefined) return; //ATON.vroadcast.socket = io();
    else ATON.vroadcast.socket = io.connect(address);

    ATON.vroadcast.connected = ATON.vroadcast.socket.connected;

    if (ATON.vroadcast.socket === undefined) return;

    ATON.vroadcast._tLastUState = 0.0;
    
    // Register update callback
	//ATON._root.addUpdateCallback( new ATON.vroadcast._uState() );
    window.setInterval(ATON.vroadcast._update, (ATON.vroadcast.uStateFreq*1000.0) );

    ATON.vroadcast.userModel = osg.createTexturedSphere(0.15, 15,15);

    ATON.vroadcast._myUser = new ATON.user();

    ATON.vroadcast._registerEventHandlers();

    //ATON.vroadcast.socket.emit("ENTER", { scene: ATON.vroadcast._scene });
};

ATON.vroadcast.setUserName = function(name){
    if (name.length < 3) return;

    ATON.vroadcast._myUser.username = name;
    ATON.vroadcast.socket.emit("UNAME", {id: ATON.vroadcast._myUser.id, name: name } );
    ATON.vroadcast.onUserMSG();
};
ATON.vroadcast.setStatus = function(status){
    ATON.vroadcast._myUser.status = status;
    ATON.vroadcast.socket.emit("UMSG", {id: ATON.vroadcast._myUser.id, status: status } );
    ATON.vroadcast.onUserMSG();
};
// Weight or rank
ATON.vroadcast.setWeight = function(w){
    ATON.vroadcast._myUser.weight = w;
    ATON.vroadcast.socket.emit("UMAGWEIGHT", {id: ATON.vroadcast._myUser.id, weight: w } ); // TODO: optimize
};
ATON.vroadcast.setMagRadius = function(r){
    ATON.vroadcast._myUser.radius = r;
    ATON.vroadcast.socket.emit("UMAGRADIUS", {id: ATON.vroadcast._myUser.id, radius: r } ); // TODO: optimize
};

ATON.vroadcast.requestRecording = function(msec){
    if (ATON.vroadcast.socket === undefined) return;

    ATON.vroadcast.socket.emit("REC", {dt: msec} );
    console.log("Requested server-side RecordTrace");
};


ATON.vroadcast.setUserInfluence = function(user, radius, forces){
    //if (ATON.vroadcast._myUser === undefined) return;

    //var u = ATON.vroadcast.users[id];
    if(user === undefined) return;

    // First time
    if (user.magNode === undefined){
        user.magNode = new ATON.magNode();
        user.magNode.setKernel(0.0);
        ATON.addMagNode( user.magNode );
        }
    
    user.magNode.setRadius(radius);
    user.magNode.setForces(forces);
};


ATON.vroadcast._update = function(){
/*
    if ((ATON._time - ATON.vroadcast._tLastUState) < ATON.vroadcast.uStateFreq) return;
    ATON.vroadcast._tLastUState = ATON._time;
*/
    manip = ATON._viewer.getManipulator();

    // myself
    var myUser = ATON.vroadcast._myUser;

    var pos = osg.vec3.create();
    var ori = osg.quat.create();

    pos[0] = ATON._currPOV.pos[0];
    pos[1] = ATON._currPOV.pos[1];
    pos[2] = ATON._currPOV.pos[2];

    osg.mat4.getRotation( ori, manip.getInverseMatrix() );
    osg.quat.invert(ori, ori);
    //var o = ori.slice(0);
    //ori[1] = -o[2];
    //ori[2] = o[1];


    // Save bandwidth
    var dPos = osg.vec3.squaredDistance(pos, myUser.lastPos);
    var dOri = osg.vec4.squaredDistance(ori, myUser.lastOri);
    
    //if (dPos < 0.002 && dOri < 0.001) return;
    if (dPos > 0.002 || dOri > 0.001){
        myUser.lastPos[0] = pos[0];
        myUser.lastPos[1] = pos[1];
        myUser.lastPos[2] = pos[2];

        myUser.lastOri[0] = ori[0];
        myUser.lastOri[1] = ori[1];
        myUser.lastOri[2] = ori[2];
        myUser.lastOri[3] = ori[3];

        // Encode and Send my data to server
        var binData = ATON.vroadcast.encodeUserStateData(pos, ori, myUser.rank);
        ATON.vroadcast.socket.emit("USTATE", binData.buffer);
        }

    // Encode and send target/focus
    var DTarg = osg.vec3.create();
/*
    DTarg[0] = ATON._currPOV.target[0] - pos[0];
    DTarg[1] = ATON._currPOV.target[1] - pos[1];
    DTarg[2] = ATON._currPOV.target[2] - pos[2];
*/
    if (ATON._hoveredVisData == undefined) return;
    DTarg[0] = ATON._hoveredVisData.p[0] - pos[0];
    DTarg[1] = ATON._hoveredVisData.p[1] - pos[1];
    DTarg[2] = ATON._hoveredVisData.p[2] - pos[2];

    var binTargD = ATON.vroadcast.encodeDFocus(DTarg);
    ATON.vroadcast.socket.emit("UFOCUSD", {id: myUser.id, bin: binTargD});
    //console.log(binTargD);

    // Polarize Focus
    if (ATON.vroadcast._bQFpol){
        var F = ATON._hoveredVisData.p.slice(0);
        ATON.vroadcast.socket.emit("POLFOC", {/*id: myUser.id, */focus: DTarg});
        }

    //console.log("User state sent.");
};

ATON.vroadcast.toggleFocusPolarization = function(){
    ATON.vroadcast._bQFpol = !ATON.vroadcast._bQFpol;
    console.log("Focus Polarization: "+ATON.vroadcast._bQFpol);
}

// Update (send state)
// NOT USED (bug in adding multiple callbacks to same node in VR)
/*
ATON.vroadcast._uState = function(){
};
ATON.vroadcast._uState.prototype = {
    update: function ( node, nv ){
        ATON.vroadcast._update();
        }
};
*/

// Encode my state
ATON.vroadcast.encodeUserStateData = function(pos, ori, rank, scale){
    if (scale === undefined) scale = 0.64;
    if (rank === undefined)  rank = 0;

    var A = new Float32Array(6); // make sufficient room
    A[0] = pos[0];
    A[1] = pos[1];
    A[2] = pos[2];

    A[3] = scale;

    // Convert to byte array, we use last float storage (4 bytes)
    var binData = new Int8Array(A.buffer);

    binData[16] = (ori[0] * 128.0);
    binData[17] = (ori[1] * 128.0);
    binData[18] = (ori[2] * 128.0);
    binData[19] = (ori[3] * 128.0);

    binData[21] = parseInt(rank);

    //console.log(binData);
    return binData;
};

// Decode incoming 24 bytes
ATON.vroadcast.decodeUserStateData = function(binData){
    var user = {};

    //console.log(binData);

    // First decode bytes
    user.ori = [
                binData[16] / 128.0,
                binData[17] / 128.0,
                binData[18] / 128.0,
                binData[19] / 128.0
                ];

    user.id   = binData[20];
    user.rank = binData[21];


    // Now decode floats
    user.pos = [];

    var a8 = new Int8Array(16);
    for (var i=0; i<16; i++) a8[i] = binData[i];

    var A = new Float32Array(a8.buffer);
    user.pos[0] = A[0];
    user.pos[1] = A[1];
    user.pos[2] = A[2];
    
    user.scale = A[3];

    //console.log(A);

    return user;
};

ATON.vroadcast.encodeDFocus = function(dtarget){
    var A = new Float32Array(3); // make sufficient room
    A[0] = dtarget[0];
    A[1] = dtarget[1];
    A[2] = dtarget[2];

    var binData = new Int8Array(A.buffer);

    return binData;
};

ATON.vroadcast.decodeDFocus = function(binData){
    var targDist = osg.vec3.create();

    var a8 = new Int8Array(12);
    for (var i=0; i<12; i++) a8[i] = binData[i];

    var A = new Float32Array(a8.buffer);
    targDist[0] = A[0];
    targDist[1] = A[1];
    targDist[2] = A[2];

    return targDist;
};


// If does not exist, create new user obj
ATON.vroadcast.touchUser = function(id){
    if (id < 0) return;

    if (ATON.vroadcast.users[id] !== undefined){
        ATON.vroadcast.users[id]._mt.setNodeMask(0xf);
        ATON.vroadcast.users[id]._focAT.setNodeMask(0xf);
        return;
        }

    // Create User (TODO: move into actor object)
    ATON.vroadcast.users[id] = new ATON.user();
    var u = ATON.vroadcast.users[id];

    // ID
    u.id = id;

    // Username
    u.name   = "User #" + id;
    u.status = "just in!";

    //u._pos = osg.vec3.create();
    //u._ori = osg.quat.create();

    u._mt = new osg.MatrixTransform();
    u._mt.setCullingActive( false ); // sometimes user repr. disappears, why?

    u._focAT = new osg.AutoTransform();
    u._focAT.setPosition([0,0,0]);
    u._focAT.setAutoRotateToScreen(true);
    //u._focAT.setAutoScaleToScreen(true);
    u._focAT.getOrCreateStateSet().setBinNumber(11);
    u._focAT.getOrCreateStateSet().setRenderingHint('TRANSPARENT_BIN');
    u._focAT.getOrCreateStateSet().setAttributeAndModes(
        //new osg.BlendFunc(osg.BlendFunc.SRC_ALPHA, osg.BlendFunc.ONE_MINUS_SRC_ALPHA), 
        new osg.BlendFunc(osg.BlendFunc.SRC_ALPHA, osg.BlendFunc.ONE_MINUS_SRC_ALPHA), 
        osg.StateAttribute.ON | osg.StateAttribute.OVERRIDE
        );
    var DFoc = new osg.Depth( osg.Depth.GREATER );
    DFoc.setRange(0.9, 1.0);
    u._focAT.getOrCreateStateSet().setAttributeAndModes( DFoc );
    u._focAT.setCullingActive( false );


    u._at = new osg.AutoTransform();
    u._at.setPosition([0,0.1,0]);
    u._at.setAutoRotateToScreen(true);
    //u._at.setAutoScaleToScreen(true);

    u._at.getOrCreateStateSet().setRenderingHint('TRANSPARENT_BIN');
    u._at.getOrCreateStateSet().setAttributeAndModes(
        new osg.BlendFunc(osg.BlendFunc.SRC_ALPHA, osg.BlendFunc.ONE_MINUS_SRC_ALPHA), 
        osg.StateAttribute.ON | osg.StateAttribute.OVERRIDE
        );

    ATON.vroadcast.realizeUserModel(id);

    ATON._groupUI.addChild(u._mt);
    ATON._groupUI.addChild(u._focAT);

    // Test (MagUsers)
    ATON.vroadcast.setUserInfluence(u, 30.0, [0.0, 0.0]); // 0.0005
/*
    if (id === 0) ATON.vroadcast.setUserInfluence(u, 30.0, [0.0, 0.0005]);
    else ATON.vroadcast.setUserInfluence(u, 10.0, [0.0, 0.0001]);
*/
};

ATON.vroadcast.realizeUserModel = function(id){
    var u = ATON.vroadcast.users[id];
    if (u === undefined) return;
    if (u._mt === undefined) return;

    // clear
    u._mt.removeChildren();
    u._focAT.removeChildren();
    u._at.removeChildren();

    u._mt.addChild(ATON.vroadcast.userModel);
    u._mt.addChild(u._at);

    // BG
    var bg = osg.createTexturedQuadGeometry(
        -0.5, 0, -0.02,      // corner
        1, 0, -0.02,       // width
        0, 0.5, -0.02 );     // height

    u._at.addChild( bg );

    var ulabID = id % 6; // no. colors

    osgDB.readImageURL(ATON.vroadcast.resPath+"assets/userlabel"+ulabID+".png").then( function ( data ){
        var bgTex = new osg.Texture();
        bgTex.setImage( data );

        bgTex.setMinFilter( osg.Texture.LINEAR_MIPMAP_LINEAR ); // LINEAR_MIPMAP_LINEAR // osg.Texture.LINEAR
        bgTex.setMagFilter( osg.Texture.LINEAR ); // osg.Texture.LINEAR
        
        bgTex.setWrapS( osg.Texture.CLAMP_TO_EDGE );
        bgTex.setWrapT( osg.Texture.CLAMP_TO_EDGE );

        bg.getOrCreateStateSet().setTextureAttributeAndModes(0, bgTex);
        console.log("Label BG loaded");
        });

    // User Focus
    var focSize = 5.0;
/*
    var focGeom = osg.createTexturedSphere(focSize, 20,20);

    var material = new osg.Material();
	material.setTransparency( 1.0 );
	material.setDiffuse( ATON.vroadcast.UCOLORS[ulabID] );
    u._focAT.getOrCreateStateSet().setAttributeAndModes( material );
    
    u._focAT.addChild(focGeom);
*/

    var focGeom = osg.createTexturedQuadGeometry(
        -(focSize*0.5), -(focSize*0.5), 0,      // corner
        focSize, 0, 0,       // width
        0, focSize, 0 );     // height

    u._focAT.addChild(focGeom);

    osgDB.readImageURL(ATON.vroadcast.resPath+"assets/mark"+ulabID+".png").then( function ( data ){
        var focTex = new osg.Texture();
        focTex.setImage( data );

        focTex.setMinFilter( osg.Texture.LINEAR_MIPMAP_LINEAR ); // LINEAR_MIPMAP_LINEAR // osg.Texture.LINEAR
        focTex.setMagFilter( osg.Texture.LINEAR ); // osg.Texture.LINEAR
        
        focTex.setWrapS( osg.Texture.CLAMP_TO_EDGE );
        focTex.setWrapT( osg.Texture.CLAMP_TO_EDGE );

        u._focAT.getOrCreateStateSet().setTextureAttributeAndModes(0, focTex);
        console.log("FocusMark loaded");        
        });

    // Name Label node
    u.nameNode = new osgText.Text(u.name);
    //u.nameNode.setColor( randColor );
    //u.nameNode.setAutoRotateToScreen( true );
    // Check if we need to force POT Textures
    if ( ATON._isMobile ){
        u.nameNode.setForcePowerOfTwo( true );
        u.nameNode.setFontResolution(32);
        //u.nameNode.setNodeMask(0x0);
        }
    
    u.nameNode.setCharacterSize( 0.3 );
    u.nameNode.setPosition( [ 0.0, 0.37, 0.001 ] );
    u._at.addChild(u.nameNode);

    // Status node
    u.statusNode = new osgText.Text(u.status);
    //u.statusNode.setColor( randColor );
    //u.statusNode.setAutoRotateToScreen( true );
    // Check if we need to force POT Textures
    if ( ATON._isMobile ){
        u.statusNode.setForcePowerOfTwo( true );
        u.statusNode.setFontResolution(8);
        //u.statusNode.setNodeMask(0x0);
        }

    u.statusNode.setCharacterSize( 0.1 );
    u.statusNode.setPosition( [ 0.0, 0.2, 0.001 ] );
    u._at.addChild(u.statusNode);

    //ATON.vroadcast.userModel.setCullingActive( false );   
};

// Set custom Model
ATON.vroadcast.setUserModel = function(url){
    var request = osgDB.readNodeURL( url );
    request.then( function ( node ){
        ATON.vroadcast.userModel = node;

        for (var u=0, len=ATON.vroadcast.users.length; u<len; u++){
            if (ATON.vroadcast.users[u]) ATON.vroadcast.realizeUserModel(u);
            }
        });
};

ATON.vroadcast.requestUserTransition = function(uid, pos, ori){
    var user = ATON.vroadcast.users[uid];
    if (user === undefined) return;

/*  TODO
    user._toPos = pos;
    user._toOri = ori;

    user._frPos = user._pos.slice(0);
    user._frOri = user._ori.slice(0);

    user._tReq  = ATON._time;
*/
    
    osg.mat4.fromRotationTranslation(user._mt.getMatrix(), ori, pos);

    user.lastPos = pos;
};

/* TODO */
ATON.vroadcast._handleUsersTransitions = function(){
    var n = ATON.vroadcast.users.length;
    if (n === 0) return;

    for (var u = 0; u < n; u++){
        var user = ATON.vroadcast.users[u];
        if (user !== undefined && user._tReq > 0.0){
            var t = (ATON._time - user._tReq) / ATON.vroadcast.uStateFreq;
            
            if (t < 1.0) osg.vec3.lerp(user._pos, user._frPos, user._toPos, t);
            else {
                user._pos[0] = user._toPos[0];
                user._pos[1] = user._toPos[1];
                user._pos[2] = user._toPos[2];

                user._tReq = -1.0;
                }

            osg.mat4.fromRotationTranslation(user._mt.getMatrix(), user._ori, user._pos);
            }
        }
};


// Handling msgs from server
ATON.vroadcast._registerEventHandlers = function(){

    // We connected to server
    ATON.vroadcast.socket.on('connect', function(){
        // Request enter in scene node (room)
        ATON.vroadcast.socket.emit("ENTER", { scene: ATON.vroadcast._scene });
        console.log("Sent enter msg for scene "+ATON.vroadcast._scene);
        //ATON.vroadcast.onUserEnter();
        });

    ATON.vroadcast.socket.on('disconnect', function(){
        console.log("DISCONNECT!!");

        ATON.vroadcast.socket.disconnect();

        // Hide all user representations
        for (let u = 0; u < ATON.vroadcast.users.length; u++) {
            const user = ATON.vroadcast.users[u];

            if (user) user._mt.setNodeMask(0x0);
            }

        if (ATON.vroadcast.onDisconnect) ATON.vroadcast.onDisconnect();
        });

    // Server assigns an ID
    ATON.vroadcast.socket.on('ID', function(data){
        console.log("Your ID is " + data.id);
        ATON.vroadcast._myUser.id = data.id;

        if (ATON.vroadcast.onIDassigned) ATON.vroadcast.onIDassigned();
        });

    // A different user state update
    ATON.vroadcast.socket.on('USTATE', function(data){
        //console.log(data.binaryData);
        var u = ATON.vroadcast.decodeUserStateData(data);

        ATON.vroadcast.touchUser(u.id);

        var user = ATON.vroadcast.users[u.id];

        if (user !== undefined){
            user.rank = u.rank;
            ATON.vroadcast.requestUserTransition(u.id, u.pos, u.ori);
            
            if (user.magNode !== undefined){
                user.magNode.setPosition(user.lastPos);
                user.magNode.setTarget(user.target);
                }
            //console.log("User "+u.id+" updated! - POS: "+u.pos);
            }

        //console.log(u);
        });
    
    // A transmission of user focal point
    ATON.vroadcast.socket.on('UFOCUSD', function(data){
        ATON.vroadcast.touchUser(data.id);

        //console.log(data);

        if (ATON.vroadcast.users[data.id] !== undefined){
            var u = ATON.vroadcast.users[data.id];

            var binData = data.bin;
            var dtarg = ATON.vroadcast.decodeDFocus(binData);

            u.target[0] = u.lastPos[0] + dtarg[0];
            u.target[1] = u.lastPos[1] + dtarg[1];
            u.target[2] = u.lastPos[2] + dtarg[2];

            u._focAT.setPosition(u.target);

            //console.log("Received Target: "+u.target);
            }

        });

    // A different user entered
    ATON.vroadcast.socket.on('ENTER', function(data){
        //console.log(data.binaryData);
        ATON.vroadcast.touchUser(data.id);

        console.log("User #" + data.id + " entered");
        ATON.vroadcast.onUserEnter();
        });

    // A user left
    ATON.vroadcast.socket.on('LEAVE', function(data){
        //console.log(data.binaryData);

        if (ATON.vroadcast.users[data.id] !== undefined) ATON.vroadcast.users[data.id]._mt.setNodeMask(0x0);

        var u = ATON.vroadcast.users[data.id];
        if (u.name !== undefined) console.log("User #"+u.name+" left");
        });

    // A user updates own username
    ATON.vroadcast.socket.on('UNAME', function(data){
        //console.log(data.binaryData);

        ATON.vroadcast.touchUser(data.id);

        if (ATON.vroadcast.users[data.id] !== undefined){
            var u = ATON.vroadcast.users[data.id];
            u.name = data.name;
            u.nameNode.setText(data.name);

            //console.log(u._at.getChildren());

            console.log("User #"+data.id+" changed username to: "+data.name);
            ATON.vroadcast.onUserMSG();
            }
        });

    // A user updates message/status
    ATON.vroadcast.socket.on('UMSG', function(data){
        //console.log(data.binaryData);

        ATON.vroadcast.touchUser(data.id);

        if (ATON.vroadcast.users[data.id] !== undefined){
            var u = ATON.vroadcast.users[data.id];
            u.status = data.status;
            u.statusNode.setText(data.status);

            console.log("User #"+data.id+" changed status to: "+data.status);
            ATON.vroadcast.onUserMSG();
            }
        });

    // A user updates weight
    ATON.vroadcast.socket.on('UMAGWEIGHT', function(data){
        //console.log(data.binaryData);

        ATON.vroadcast.touchUser(data.id);

        if (ATON.vroadcast.users[data.id] !== undefined){
            var u = ATON.vroadcast.users[data.id];
            u.weight = data.weight;

            ATON.vroadcast.setUserInfluence(u, u.radius, [0.0, u.weight]);

            console.log("User #"+data.id+" has now weight: "+data.weight);
            }
        });

    // A user updates its mag radius
    ATON.vroadcast.socket.on('UMAGRADIUS', function(data){
        //console.log(data.binaryData);

        ATON.vroadcast.touchUser(data.id);

        if (ATON.vroadcast.users[data.id] !== undefined){
            var u = ATON.vroadcast.users[data.id];
            u.radius = data.radius;

            ATON.vroadcast.setUserInfluence(u, u.radius, [0.0, u.weight]);

            console.log("User #"+data.id+" has now weight: "+data.weight);
            }
        });

    // TODO: Object Spawning
    ATON.vroadcast.socket.on('SPAWN', function(data){
        var path = data.path;
        var pos  = [data.x, data.y, data.z];

        });

};