/*
    ATON VRoadcast
    real-time collaborative networking

    author: bruno.fanini_AT_gmail.com

===========================================================*/

import Avatar from "./ATON.avatar.js";


let VRoadcast = {};

VRoadcast.USER_STATE_FREQ = 0.25; // sec
VRoadcast.REPLICATED_EVT = "EREP";

// Thresholds state sending
VRoadcast.THRES_STATE_POS = 0.01;
VRoadcast.THRES_STATE_ORI = 0.08; // radians

VRoadcast.Avatar = Avatar;


// Init routine
VRoadcast.init = ()=>{
    VRoadcast.address = window.location.origin;

    VRoadcast.initMaterials();

    VRoadcast.socket = undefined;
    VRoadcast._connected = false;

    //VRoadcast.sid = "_SHARED_";
    VRoadcast.uid = undefined; // my userID (0,1,....)

    VRoadcast.avatarList = [];

    VRoadcast.avaGroup = ATON.createUINode("avatars"); // holds all avatars representations
    VRoadcast.avaGroup.attachToRoot();

    // send own state with given freq
    window.setInterval( VRoadcast.sendState, VRoadcast.USER_STATE_FREQ*1000.0 );
    VRoadcast._lastStateSent = undefined;

    console.log("VRoadcast initialized");
};

// Register materials (avatars/users)
VRoadcast.initMaterials = ()=>{

    VRoadcast.ucolors = [];
    VRoadcast.ucolors.push( new THREE.Color(1,0,0) );
    VRoadcast.ucolors.push( new THREE.Color(1,1,0) );
    VRoadcast.ucolors.push( new THREE.Color(0,1,0) );
    VRoadcast.ucolors.push( new THREE.Color(0,1,1) );
    VRoadcast.ucolors.push( new THREE.Color(0,0,1) );
    VRoadcast.ucolors.push( new THREE.Color(1,0,1) );

    VRoadcast.ucolorsdark = [];
    VRoadcast.ucolorsdark.push( new THREE.Color(0.2,0.0,0.0) );
    VRoadcast.ucolorsdark.push( new THREE.Color(0.2,0.2,0.0) );
    VRoadcast.ucolorsdark.push( new THREE.Color(0.0,0.2,0.0) );
    VRoadcast.ucolorsdark.push( new THREE.Color(0.0,0.2,0.2) );
    VRoadcast.ucolorsdark.push( new THREE.Color(0.0,0.0,0.2) );
    VRoadcast.ucolorsdark.push( new THREE.Color(0.2,0.0,0.2) );

    let MM = ATON.MatHub.materials;
    MM.avatars = [];

    let mat = new THREE.MeshBasicMaterial({
        color: VRoadcast.ucolors[0], 
        transparent: true, 
        opacity: 0.4, 
        depthWrite: false,
        flatShading: true
    });

    MM.avatars.push(mat);

    for (let c=1; c<VRoadcast.ucolors.length; c++){
        let M = mat.clone();
        M.color = VRoadcast.ucolors[c];

        MM.avatars.push(M);
    }
};

// Fire replicated event (network)
VRoadcast.fireEvent = (evtname, data)=>{
    if (!VRoadcast._connected) return;
    let sock = VRoadcast.socket;

    if (sock) sock.emit(VRoadcast.REPLICATED_EVT, {e: evtname, d: data});
    //else ATON.on("VRC_Connected", ()=>{ sock.on(evtname, onReceive); });
};

// Receive network event
VRoadcast.on = (evtname, handler)=>{
    if (handler === undefined) return;

    let evhNetwork = ATON.EventHub.evNetwork;

    if (evhNetwork[evtname] === undefined) evhNetwork[evtname] = []; // First time (event not registered)
    evhNetwork[evtname].push(handler);
};


VRoadcast.isConnected = ()=>{
    return VRoadcast._connected;
};

// Request enter in scene (room) by sid
VRoadcast.requestSceneEnter = (sceneid)=>{
    if (!VRoadcast.socket) return;
    if (sceneid === undefined) sceneid = ATON.SceneHub.currID;

    if (sceneid === undefined){
        console.log("VRC ERROR: current scene ID is undefined");
        return;
    }

    VRoadcast.socket.emit("SENTER", sceneid );
};

VRoadcast.connect = (address)=>{
    if (address) VRoadcast.address = address;

    let opts = {};

    // Secure connection
    if (window.location.protocol === "https:"){
        opts.path = '/svrc/socket.io';
        opts.secure = true;
        opts.rejectUnauthorized = false;
        //opts.transports = ['websocket'], 
        //opts.upgrade = false 
    }
    else {
        opts.path = '/vrc/socket.io';
    }

    VRoadcast.socket = io.connect(VRoadcast.address, opts); //, { 'force new connection': true });

    if (VRoadcast.socket === undefined) return;
    VRoadcast._connected = VRoadcast.socket.connected;

    VRoadcast._registerSocketHandlers();
};


VRoadcast._onConnected = ()=>{
    //
};

VRoadcast.setUsername = (username)=>{
    VRoadcast._username = username;
    if (VRoadcast.socket === undefined) return;

    VRoadcast.socket.emit("UNAME", username);
};

// Handle incoming server msgs
VRoadcast._registerSocketHandlers = ()=>{

    // We connected to server
    VRoadcast.socket.on('connect', ()=>{
        VRoadcast._connected = true;

        // Request enter in scene node (room)
        if (ATON.SceneHub.currID !== undefined) VRoadcast.requestSceneEnter();
        
        console.log("VRC connected, entering scene: "+ATON.SceneHub.currID);
        ATON.fireEvent("VRC_Connected");

        VRoadcast._onConnected();
    });

    VRoadcast.socket.on('disconnect', ()=>{
        VRoadcast._connected = false;
        VRoadcast.uid = undefined;

        VRoadcast.avaGroup.hide();

        console.log("VRC disconnected!");
        ATON.fireEvent("VRC_Disconnected");
    });

    // Incoming replicated event
    VRoadcast.socket.on(VRoadcast.REPLICATED_EVT, (data)=>{
        let evtname = data.e;
        let d = data.d;

        let ehList = ATON.EventHub.evNetwork[evtname];
        ATON.EventHub.executeHandlers(ehList, d);
    });

    VRoadcast.socket.on('ID', (data)=>{
        console.log("Your ID is " + data);
        VRoadcast.uid = data;

        //if (ATON.vroadcast.onIDassigned) ATON.vroadcast.onIDassigned();
        ATON.fireEvent("VRC_IDassigned", data.id);
    });

    VRoadcast.socket.on('UENTER', (data)=>{
        let uid = data;
        //if (uid === VRoadcast.uid) return; // myself

        console.log("User #" +uid+" entered the scene");

        VRoadcast.touchAvatar(uid);
    });

    VRoadcast.socket.on('ULEAVE', (data)=>{
        let uid = data;
        
        let A = VRoadcast.avatarList[uid];
        if (A) A.hide();

        console.log("User #" +uid+" left the scene");
    });

    VRoadcast.socket.on('USTATE', (data)=>{
        let S = VRoadcast.decodeState(data);

        let uid = S.userid;
        let A = VRoadcast.touchAvatar(uid);

        //A.position.copy(S.position);
        //A.quaternion.copy(S.quaternion);
        A.requestStateTransition(S);
    });

    VRoadcast.socket.on('UNAME', (data)=>{
        let uid   = data.uid;
        let uname = data.name;

        let A = VRoadcast.touchAvatar(uid);
        A.setUsername(uname);
        console.log("User #" +uid+" changed username to: "+uname);
    });
};

// Encode state
VRoadcast.encodeState = (S)=>{
    if (!S) return;

    let A = new Float32Array(6); // make sufficient room
    A[0] = S.position.x;
    A[1] = S.position.y;
    A[2] = S.position.z;

    // Convert to byte array, we use last float storage (4 bytes)
    var binData = new Int8Array(A.buffer);

    binData[16] = (S.quaternion.x * 128.0);
    binData[17] = (S.quaternion.y * 128.0);
    binData[18] = (S.quaternion.z * 128.0);
    binData[19] = (S.quaternion.w * 128.0);

    binData[20] = S.userid;

    //binData[21] = parseInt(S.rank);

    return binData;
}

// Decode state
VRoadcast.decodeState = (binData)=>{
    let S = {};
    S.userid = binData[20];

    // First decode quat
    S.quaternion = new THREE.Quaternion(
        binData[16] / 128.0,
        binData[17] / 128.0,
        binData[18] / 128.0,
        binData[19] / 128.0
    );

    // Now decode floats
    let a8 = new Int8Array(16);
    for (var i=0; i<16; i++) a8[i] = binData[i];
    let A = new Float32Array(a8.buffer);

    S.position = new THREE.Vector3(A[0],A[1],A[2]);

    //S.scale = A[3];

    return S;
}


// Update
VRoadcast.update = ()=>{

    // State interpolation
    for (let a=0; a<VRoadcast.avatarList.length; a++){
        let A = VRoadcast.avatarList[a];
        if (A && A.visible){
            A._tStateDur = VRoadcast.USER_STATE_FREQ;
            A.update();
        }
    }
};

VRoadcast.sendState = ()=>{
    if (VRoadcast.uid === undefined) return;
    if (!VRoadcast.socket || !VRoadcast._connected) return;
    
    let cpov = ATON.Nav._currPOV;
    if (!cpov) return;

    //console.log(cpov);

    let S = {};
    S.position = new THREE.Vector3();
    S.quaternion = new THREE.Quaternion();

    S.position.copy(cpov.pos);
    S.quaternion.copy(ATON.Nav._qOri);
    S.userid = VRoadcast.uid;

    // Save bandwidth
    if (VRoadcast._lastStateSent !== undefined){
        let lastPos = VRoadcast._lastStateSent.position;
        let lastOri = VRoadcast._lastStateSent.quaternion;

        let dPos = lastPos.distanceToSquared(cpov.pos);
        let dOri = lastOri.angleTo(ATON.Nav._qOri);

        if ( dPos < VRoadcast.THRES_STATE_POS && dOri < VRoadcast.THRES_STATE_ORI) return;
    }

    // Encode and send
    let binData = VRoadcast.encodeState(S);
    VRoadcast.socket.emit("USTATE", binData/*.buffer*/ );
    VRoadcast._lastStateSent = S;

    //console.log("State sent");
};


// Avatars
VRoadcast.getAvatar = (uid)=>{
    return VRoadcast.avatarList[uid];
};

VRoadcast.touchAvatar = (uid)=>{

    // First time
    if (VRoadcast.avatarList[uid] === undefined){
        let A = new VRoadcast.Avatar(uid);
        A.attachTo(VRoadcast.avaGroup);
        
        A.loadRepresentation(ATON.PATH_RES+"models/vrc/head.gltf");
        //console.log(VRoadcast.avaGroup);

        VRoadcast.avatarList[uid] = A;

        //console.log(VRoadcast.avatarList);
        //console.log(ATON.MatHub.materials.avatars);
        //console.log(A);
    }

    let A = VRoadcast.avatarList[uid];
    A.show();

    return A;
}

VRoadcast.clearAllAvatars = ()=>{
    for (let i in VRoadcast.avatarList){
        let A = VRoadcast.avatarList[i];
        A.hide();
        //A.dispose();
    }
};

export default VRoadcast;