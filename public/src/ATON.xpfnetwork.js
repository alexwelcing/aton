/*
    ATON Utils
    various utilities for device profiling, graph visiting, etc.

    author: bruno.fanini_AT_gmail.com

===========================================================*/

/**
ATON Utils
@namespace XPFNetwork
*/
let XPFNetwork = {};

XPFNetwork.STD_XPF_TRANSITION_DURATION = 1.0;


XPFNetwork.init = ()=>{
    XPFNetwork._list  = [];
    XPFNetwork._iCurr = undefined;

    XPFNetwork._group = new THREE.Group();
    ATON._rootVisibleGlobal.add( XPFNetwork._group );

    XPFNetwork._geom = undefined;
    XPFNetwork._mesh = undefined;
    XPFNetwork._mat  = undefined;
    XPFNetwork._size = 20.0;

    XPFNetwork.realizeBaseGeometry();
};

XPFNetwork.realizeBaseGeometry = ()=>{
    if (XPFNetwork._geom !== undefined) return; // already realized

    // Default geometry
    XPFNetwork._geom = new THREE.SphereBufferGeometry( 1.0, 60,60 );
    XPFNetwork._geom.scale( -XPFNetwork._size, XPFNetwork._size, XPFNetwork._size );
        
    XPFNetwork._geom.castShadow    = false;
    XPFNetwork._geom.receiveShadow = false;

    XPFNetwork._mat = new THREE.MeshBasicMaterial({ 
        //map: tpano,
        ///emissive: tpano,
        //fog: false,
        
        depthTest: false,
        depthWrite: false,
        
        ///depthFunc: THREE.AlwaysDepth,
        //side: THREE.BackSide, // THREE.DoubleSide
    });

    XPFNetwork._mesh = new THREE.Mesh(XPFNetwork._geom, XPFNetwork._mat);
    XPFNetwork._mesh.frustumCulled = false;
    XPFNetwork._mesh.renderOrder   = -100;

    XPFNetwork._group.add( XPFNetwork._mesh );
    XPFNetwork._mesh.visible = false;
};

// TODO:
XPFNetwork.setBaseGeometry = (geom)=>{
    //xxx.geometry.dispose();
    //xxx.geometry = geom;
};

XPFNetwork.add = (xpf)=>{
    if (xpf === undefined) return;

    let i = XPFNetwork._list.length;
    XPFNetwork._list.push(xpf);

    xpf._lnode.associateToXPF(i);

    let m = xpf.getMesh();
    if (m) XPFNetwork._group.add( m );
};

// Retrieve main XPF network group (transform or manipulate the entire network)
XPFNetwork.getMainGroup = ()=>{
    return XPFNetwork._group;
};

XPFNetwork.setCurrentXPF = (i, onComplete)=>{
    XPFNetwork._iCurr = i;

    let xpf = XPFNetwork._list[i];
    if (xpf === undefined) return;

    ATON.Utils.textureLoader.load(xpf._pathbaselayer, (tex)=>{
        tex.encoding = THREE.sRGBEncoding;
        //tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = true;

        XPFNetwork._mat.map = tex;

        XPFNetwork._mat.map.needsUpdate = true;
        XPFNetwork._mat.needsUpdate = true

        console.log("XPF base layer "+xpf._pathbaselayer+" loaded");

        XPFNetwork._mesh.position.copy( xpf.getLocation() );
        XPFNetwork._mesh.rotation.set( xpf.getRotation().x, xpf.getRotation().y, xpf.getRotation().z );

        if (onComplete) onComplete();
    });

    XPFNetwork._mesh.visible = true;
};

XPFNetwork.getCurrentXPFindex = ()=>{
    return XPFNetwork._iCurr;
};
XPFNetwork.getCurrentXPF = ()=>{
    if (XPFNetwork._iCurr === undefined) return undefined;
    return XPFNetwork._list[XPFNetwork._iCurr];
};


XPFNetwork.requestTransitionByIndex = (i)=>{
    let xpf = XPFNetwork._list[i];
    if (xpf === undefined) return;

    let dur = XPFNetwork.STD_XPF_TRANSITION_DURATION;
    if (ATON.XR._bPresenting) dur = 0.0;

    //ATON.Nav.requestTransitionToLocomotionNode( xpf.getLocomotionNode(), XPFNetwork.STD_XPF_TRANSITION_DURATION );
    XPFNetwork.setCurrentXPF(i, ()=>{
        ATON.Nav.requestTransitionToLocomotionNode( xpf.getLocomotionNode(), dur );
    });
};

XPFNetwork.setHomeXPF = (i)=>{
    let xpf = XPFNetwork._list[i];
    if (xpf === undefined) return;

    let lnode = xpf.getLocomotionNode();

    let POV = new ATON.POV()
        .setPosition(lnode.pos)
        .setTarget(
            lnode.pos.x,
            lnode.pos.y, 
            lnode.pos.z + 1.0
        )
        //.setFOV(ATON.Nav._currPOV.fov);

    //console.log(POV)
    ATON.Nav.setHomePOV(POV);
};

// TODO: Sphera, OPK
XPFNetwork.loadFromFile = (configfile)=>{

};

export default XPFNetwork;