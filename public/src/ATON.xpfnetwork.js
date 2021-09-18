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
    XPFNetwork._size = 50.0;

    XPFNetwork._txCache = {};

    XPFNetwork.realizeBaseGeometry();
};


// This is required to select closest (current) XPF to user location
XPFNetwork.update = ()=>{
    if (ATON.Nav.isTransitioning()) return;
    if (XPFNetwork._list.length < 1) return;

    let len = XPFNetwork._list.length;
    
    let E = ATON.Nav._currPOV.pos;
    let V = ATON.Nav._vDir;

    let mindist  = undefined;
    let iclosest = undefined;

    let nxdist   = undefined;
    let inext    = undefined;

    if (XPFNetwork._dirLNode === undefined) XPFNetwork._dirLNode = new THREE.Vector3();

    for (let i=0; i<len; i++){
        let xpf = XPFNetwork._list[i];
        //xpf._lnode.toggleSUI(false);

        // Search closest
        let d = E.distanceToSquared(xpf._location);
        if (mindist === undefined || d < mindist){
            mindist  = d;
            iclosest = i;
        }

        // Seek next in sight
        if (i !== XPFNetwork._iCurr){
            XPFNetwork._dirLNode.x = xpf._location.x - E.x;
            XPFNetwork._dirLNode.y = xpf._location.y - E.y;
            XPFNetwork._dirLNode.z = xpf._location.z - E.z;

            let v = XPFNetwork._dirLNode.dot(V);
            if (v > 0.8){
                if (nxdist === undefined || d < nxdist){
                    nxdist = d;
                    inext  = i;
                }
            }
        }
    }

    //console.log(inext);
    if (inext){
        XPFNetwork._preloadBaseLayer(inext);
        //XPFNetwork._list[inext]._lnode.toggleSUI(true);
    }

    if (iclosest === XPFNetwork._iCurr) return;
    XPFNetwork.setCurrentXPF(iclosest);

    XPFNetwork._clearTexCache(); // We moved to another XPF, clear cached textures

    ATON.fireEvent("CurrentXPF", iclosest);
    //console.log("Current XPF: "+iclosest);
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

    XPFNetwork._mesh.layers.enable(ATON.NTYPES.SCENE);

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

    //xpf._lnode.associateToXPF(i);

    let m = xpf.getMesh();
    if (m) XPFNetwork._group.add( m );

    if (i > 0) return;
    ATON.Nav.toggleLocomotionValidator(false);
    ATON._bqScene = true;
};

// Retrieve main XPF network group (transform or manipulate the entire network)
XPFNetwork.getMainGroup = ()=>{
    return XPFNetwork._group;
};

XPFNetwork._preloadBaseLayer = (i, onComplete)=>{
    if (XPFNetwork._txCache[i] !== undefined){
        return XPFNetwork._txCache[i];
    }

    let xpf = XPFNetwork._list[i];

    ATON.Utils.textureLoader.load(xpf._pathbaselayer, (tex)=>{
        tex.encoding = THREE.sRGBEncoding;
        //tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = true;

        XPFNetwork._txCache[i] = tex;
        console.log("Preloaded XPF "+i);

        if (onComplete) onComplete(tex);
    });
};

XPFNetwork._clearTexCache = ()=>{
    if (XPFNetwork._iCurr === undefined) return;

    for (let i in XPFNetwork._txCache){
        if (XPFNetwork._txCache[i] && i !== XPFNetwork._iCurr){
            XPFNetwork._txCache[i].dispose();
            XPFNetwork._txCache[i] = undefined;
        }
    }
};

// TODO:
XPFNetwork._setBaseLayerTexture = (xpf, tex)=>{
    XPFNetwork._mat.map = tex;
    XPFNetwork._mat.map.needsUpdate = true;
    XPFNetwork._mat.needsUpdate     = true;

    XPFNetwork._mesh.position.copy( xpf.getLocation() );
    XPFNetwork._mesh.rotation.set( xpf.getRotation().x, xpf.getRotation().y, xpf.getRotation().z );
};

XPFNetwork.setCurrentXPF = (i, onComplete)=>{
    let xpf = XPFNetwork._list[i];
    if (xpf === undefined) return;

    XPFNetwork._iCurr = i;
    XPFNetwork._mesh.visible = true;

    // hit
    if (XPFNetwork._txCache[i]){
        //console.log("hit");
        XPFNetwork._setBaseLayerTexture(xpf, XPFNetwork._txCache[i]);
        if (onComplete) onComplete();
        return;
    }

    // load tex
    XPFNetwork._preloadBaseLayer(i, (tex)=>{
        //console.log("miss");
        XPFNetwork._setBaseLayerTexture(xpf, tex);
        if (onComplete) onComplete();
    });
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

    ATON.Nav.requestTransitionToLocomotionNode( xpf.getLocomotionNode(), dur );

/*
    XPFNetwork.setCurrentXPF(i, ()=>{
        ATON.Nav.requestTransitionToLocomotionNode( xpf.getLocomotionNode(), dur );
    });
*/
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