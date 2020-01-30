import React, { Component } from 'react';
import PropTypes from 'prop-types';
import NodeProps from './NodeProps';
import NodeCypherLink from './Components/NodeCypherLink';
import NodeCypherNoNumberLink from './Components/NodeCypherNoNumberLink';
import NodeCypherLinkComplex from './Components/NodeCypherLinkComplex';
import Gallery from 'react-photo-gallery';
import SelectedImage from './Components/SelectedImage';
import Lightbox from 'react-images';
import { readFileSync, writeFileSync } from 'fs';
import sizeOf from 'image-size';
import md5File from 'md5-file';
import { remote } from 'electron';
const { app } = remote;
import { join } from 'path';
import { withAlert } from 'react-alert';
import NodePlayCypherLink from './Components/NodePlayCypherLink';

class UserNodeData extends Component {
    constructor() {
        super();

        this.state = {
            label: '',
            driversessions: [],
            propertyMap: {},
            ServicePrincipalNames: [],
            AllowedToDelegate: [],
            HasSIDHistory: [],
            displayMap: {
                displayname: 'Display Name',
                pwdlastset: 'Password Last Changed',
                lastlogontimestamp: 'Last Logon',
                enabled: 'Enabled',
                email: 'Email',
                title: 'Title',
                homedirectory: 'Home Directory',
                description: 'Description',
                userpassword: 'User Password',
                admincount: 'AdminCount',
                owned: 'Compromised',
                sensitive: 'Cannot Be Delegated',
                dontreqpreauth: 'ASREP Roastable',
            },
            notes: null,
            pics: [],
            currentImage: 0,
            lightboxIsOpen: false,
            objectid: '',
        };

        emitter.on('userNodeClicked', this.getNodeData.bind(this));
        emitter.on('computerNodeClicked', this.nullTarget.bind(this));
        emitter.on('groupNodeClicked', this.nullTarget.bind(this));
        emitter.on('domainNodeClicked', this.nullTarget.bind(this));
        emitter.on('gpoNodeClicked', this.nullTarget.bind(this));
        emitter.on('ouNodeClicked', this.nullTarget.bind(this));
        emitter.on('imageUploadFinal', this.uploadImage.bind(this));
        emitter.on('clickPhoto', this.openLightbox.bind(this));
        emitter.on('deletePhoto', this.handleDelete.bind(this));
    }

    nullTarget() {
        this.setState({
            label: '',
        });
    }

    uploadImage(files) {
        if (!this.props.visible || files.length === 0) {
            return;
        }
        let p = this.state.pics;
        let oLen = p.length;
        let key = `user_${this.state.label}`;

        $.each(files, (_, f) => {
            let exists = false;
            let hash = md5File.sync(f.path);
            $.each(p, (_, p1) => {
                if (p1.hash === hash) {
                    exists = true;
                }
            });
            if (exists) {
                this.props.alert.error('Image already exists');
                return;
            }
            let path = join(app.getPath('userData'), 'images', hash);
            let dimensions = sizeOf(f.path);
            let data = readFileSync(f.path);
            writeFileSync(path, data);
            p.push({
                hash: hash,
                src: path,
                width: dimensions.width,
                height: dimensions.height,
            });
        });

        if (p.length === oLen) {
            return;
        }
        this.setState({ pics: p });
        imageconf.set(key, p);
        let check = jQuery(this.refs.piccomplete);
        check.show();
        check.fadeOut(2000);
    }

    handleDelete(event) {
        if (!this.props.visible) {
            return;
        }
        let pics = this.state.pics;
        pics.splice(event.index, 1);
        this.setState({
            pics: pics,
        });
        let key = `user_${this.state.label}`;
        imageconf.set(key, pics);

        let check = jQuery(this.refs.piccomplete);
        check.show();
        check.fadeOut(2000);
    }

    openLightbox(event) {
        if (!this.props.visible) {
            return;
        }
        this.setState({
            currentImage: event.index,
            lightboxIsOpen: true,
        });
    }
    closeLightbox() {
        if (!this.props.visible) {
            return;
        }
        this.setState({
            currentImage: 0,
            lightboxIsOpen: false,
        });
    }
    gotoPrevious() {
        if (!this.props.visible) {
            return;
        }
        this.setState({
            currentImage: this.state.currentImage - 1,
        });
    }
    gotoNext() {
        if (!this.props.visible) {
            return;
        }
        this.setState({
            currentImage: this.state.currentImage + 1,
        });
    }

    getNodeData(payload) {
        jQuery(this.refs.complete).hide();
        jQuery(this.refs.piccomplete).hide();
        $.each(this.state.driversessions, function(index, record) {
            record.close();
        });

        this.setState({
            objectid: payload,
            propertyMap: {},
            ServicePrincipalNames: [],
            driversessions: [],
        });

        let key = `user_${this.state.label}`;
        let c = imageconf.get(key);
        let pics = [];
        if (typeof c !== 'undefined') {
            this.setState({ pics: c });
        } else {
            this.setState({ pics: pics });
        }

        var props = driver.session();
        props
            .run('MATCH (n:User {objectid: $objectid}) RETURN n', {
                objectid: payload,
            })
            .then(result => {
                var properties = result.records[0]._fields[0].properties;
                let name = properties.name || properties.objectid;

                let spn;
                if (!properties.serviceprincipalnames) {
                    spn = [];
                } else {
                    spn = properties.serviceprincipalnames;
                }
                let notes;
                if (!properties.notes) {
                    notes = null;
                } else {
                    notes = properties.notes;
                }

                let del;
                if (!properties.allowedtodelegate) {
                    del = [];
                } else {
                    del = properties.allowedtodelegate;
                }

                let sih;
                if (!properties.sidhistory) {
                    sih = [];
                } else {
                    sih = properties.sidhistory;
                }

                this.setState({
                    ServicePrincipalNames: spn,
                    AllowedToDelegate: del,
                    HasSIDHistory: sih,
                    propertyMap: properties,
                    notes: notes,
                    label: name,
                });

                props.close();
            });
        this.setState({ driversessions: [props] });
    }

    notesChanged(event) {
        this.setState({ notes: event.target.value });
    }

    notesBlur(event) {
        let notes =
            this.state.notes === null || this.state.notes === ''
                ? null
                : this.state.notes;
        let q = driver.session();
        if (notes === null) {
            q.run('MATCH (n:User {objectid:$objectid}) REMOVE n.notes', {
                objectid: this.state.objectid,
            }).then(x => {
                q.close();
            });
        } else {
            q.run('MATCH (n:User {objectid:$objectid}) SET n.notes = {notes}', {
                objectid: this.state.objectid,
                notes: this.state.notes,
            }).then(x => {
                q.close();
            });
        }
        let check = jQuery(this.refs.complete);
        check.show();
        check.fadeOut(2000);
    }

    render() {
        let domain = this.state.propertyMap.domain || '';

        let gallery;
        if (this.state.pics.length === 0) {
            gallery = <span>Drop pictures on here to upload!</span>;
        } else {
            gallery = (
                <React.Fragment>
                    <Gallery
                        photos={this.state.pics}
                        ImageComponent={SelectedImage}
                        className={'gallerymod'}
                    />
                    <Lightbox
                        images={this.state.pics}
                        isOpen={this.state.lightboxIsOpen}
                        onClose={this.closeLightbox.bind(this)}
                        onClickPrev={this.gotoPrevious.bind(this)}
                        onClickNext={this.gotoNext.bind(this)}
                        currentImage={this.state.currentImage}
                    />
                </React.Fragment>
            );
        }

        return (
            <div className={this.props.visible ? '' : 'displaynone'}>
                <dl className='dl-horizontal'>
                    <h4>User Info</h4>
                    <dt>Name</dt>
                    <dd>{this.state.label}</dd>
                    <NodeProps
                        properties={this.state.propertyMap}
                        displayMap={this.state.displayMap}
                        ServicePrincipalNames={this.state.ServicePrincipalNames}
                        HasSIDHistory={this.state.HasSIDHistory}
                        AllowedToDelegate={this.state.AllowedToDelegate}
                    />

                    <NodeCypherLink
                        property='Sessions'
                        target={this.state.objectid}
                        baseQuery={
                            'MATCH p=(m:Computer)-[r:HasSession]->(n:User {objectid: $objectid})'
                        }
                        end={this.state.label}
                    />

                    <NodeCypherLinkComplex
                        property='Sibling Objects in the Same OU'
                        target={this.state.objectid}
                        countQuery={
                            'MATCH (o1)-[r1:Contains]->(o2:User {objectid: $objectid}) WITH o1 OPTIONAL MATCH p1=(d)-[r2:Contains*1..]->(o1) OPTIONAL MATCH p2=(o1)-[r3:Contains]->(n) WHERE n:User OR n:Computer RETURN count(distinct(n))'
                        }
                        graphQuery={
                            'MATCH (o1)-[r1:Contains]->(o2:User {objectid: $objectid}) WITH o1 OPTIONAL MATCH p1=(d)-[r2:Contains*1..]->(o1) OPTIONAL MATCH p2=(o1)-[r3:Contains]->(n) WHERE n:User OR n:Computer RETURN p1,p2'
                        }
                    />

                    <NodeCypherLink
                        property='Reachable High Value Targets'
                        target={this.state.objectid}
                        baseQuery={
                            'MATCH (m:User {objectid: $objectid}),(n {highvalue:true}),p=shortestPath((m)-[r*1..]->(n)) WHERE NONE (r IN relationships(p) WHERE type(r)= "GetChanges") AND NONE (r in relationships(p) WHERE type(r)="GetChangesAll") AND NOT m=n'
                        }
                        start={this.state.label}
                    />

                    <NodeCypherLinkComplex
                        property='Effective Inbound GPOs'
                        target={this.state.objectid}
                        countQuery={
                            'MATCH (c:User {objectid: $objectid}) OPTIONAL MATCH p1 = (g1:GPO)-[r1:GpLink {enforced:true}]->(container1)-[r2:Contains*1..]->(c) OPTIONAL MATCH p2 = (g2:GPO)-[r3:GpLink {enforced:false}]->(container2)-[r4:Contains*1..]->(c) WHERE NONE (x in NODES(p2) WHERE x.blocksinheritance = true AND x:OU AND NOT (g2)-->(x)) RETURN count(g1)+count(g2)'
                        }
                        graphQuery={
                            'MATCH (c:User {objectid: $objectid}) OPTIONAL MATCH p1 = (g1:GPO)-[r1:GpLink {enforced:true}]->(container1)-[r2:Contains*1..]->(c) OPTIONAL MATCH p2 = (g2:GPO)-[r3:GpLink {enforced:false}]->(container2)-[r4:Contains*1..]->(c) WHERE NONE (x in NODES(p2) WHERE x.blocksinheritance = true AND x:OU AND NOT (g2)-->(x)) RETURN p1,p2'
                        }
                    />

                    <NodeCypherNoNumberLink
                        target={this.state.objectid}
                        property='See User within Domain/OU Tree'
                        query='MATCH p = (d:Domain)-[r:Contains*1..]->(u:User {objectid: $objectid}) RETURN p'
                    />

                    <h4>Group Membership</h4>

                    <NodeCypherLink
                        property='First Degree Group Memberships'
                        target={this.state.objectid}
                        baseQuery={
                            'MATCH (m:User {objectid: $objectid}), (n:Group), p=(m)-[:MemberOf]->(n)'
                        }
                        start={this.state.label}
                    />

                    <NodeCypherLink
                        property='Unrolled Group Membership'
                        target={this.state.objectid}
                        baseQuery={
                            'MATCH p = (m:User {objectid: $objectid})-[r:MemberOf*1..]->(n:Group)'
                        }
                        start={this.state.label}
                        distinct
                    />

                    <NodeCypherLink
                        property='Foreign Group Membership'
                        target={this.state.objectid}
                        baseQuery={
                            'MATCH (m:User {objectid: $objectid}) MATCH (n:Group) WHERE NOT m.domain=n.domain MATCH p=(m)-[r:MemberOf*1..]->(n)'
                        }
                        start={this.state.label}
                        domain={domain}
                    />

                    <h4>Local Admin Rights</h4>

                    <NodeCypherLink
                        property='First Degree Local Admin'
                        target={this.state.objectid}
                        baseQuery={
                            'MATCH p=(m:User {objectid: $objectid})-[r:AdminTo]->(n:Computer)'
                        }
                        start={this.state.label}
                        distinct
                    />

                    <NodeCypherLink
                        property='Group Delegated Local Admin Rights'
                        target={this.state.objectid}
                        baseQuery={
                            'MATCH p=(m:User {objectid: $objectid})-[r1:MemberOf*1..]->(g:Group)-[r2:AdminTo]->(n:Computer)'
                        }
                        start={this.state.label}
                        distinct
                    />

                    <NodePlayCypherLink
                        property='Derivative Local Admin Rights'
                        target={this.state.objectid}
                        baseQuery={
                            'MATCH p=shortestPath((m:User {objectid: $objectid})-[r:HasSession|AdminTo|MemberOf*1..]->(n:Computer))'
                        }
                        start={this.state.label}
                        distinct
                    />

                    <h4>Execution Privileges</h4>
                    <NodeCypherLink
                        property='First Degree RDP Privileges'
                        target={this.state.objectid}
                        baseQuery={
                            'MATCH p=(m:User {objectid: $objectid})-[r:CanRDP]->(n:Computer)'
                        }
                        start={this.state.label}
                        distinct
                    />

                    <NodeCypherLink
                        property='Group Delegated RDP Privileges'
                        target={this.state.objectid}
                        baseQuery={
                            'MATCH p=(m:User {objectid: $objectid})-[r1:MemberOf*1..]->(g:Group)-[r2:CanRDP]->(n:Computer)'
                        }
                        start={this.state.label}
                        distinct
                    />

                    <NodeCypherLink
                        property='First Degree DCOM Privileges'
                        target={this.state.objectid}
                        baseQuery={
                            'MATCH p=(m:User {objectid: $objectid})-[r:ExecuteDCOM]->(n:Computer)'
                        }
                        start={this.state.label}
                        distinct
                    />

                    <NodeCypherLink
                        property='Group Delegated DCOM Privileges'
                        target={this.state.objectid}
                        baseQuery={
                            'MATCH p=(m:User {objectid: $objectid})-[r1:MemberOf*1..]->(g:Group)-[r2:ExecuteDCOM]->(n:Computer)'
                        }
                        start={this.state.label}
                        distinct
                    />

                    <NodeCypherLink
                        property='SQL Admin Rights'
                        target={this.state.objectid}
                        baseQuery={
                            'MATCH p=(m:User {objectid: $objectid})-[r:SQLAdmin]->(n:Computer)'
                        }
                        start={this.state.label}
                        distinct
                    />

                    <NodeCypherLink
                        property='Constrained Delegation Privileges'
                        target={this.state.objectid}
                        baseQuery={
                            'MATCH p=(m:User {objectid: $objectid})-[r:AllowedToDelegate]->(n:Computer)'
                        }
                        start={this.state.label}
                        distinct
                    />

                    <h4>Outbound Object Control</h4>

                    <NodeCypherLink
                        property='First Degree Object Control'
                        target={this.state.objectid}
                        baseQuery={
                            'MATCH p=(u:User {objectid: $objectid})-[r1]->(n) WHERE r1.isacl=true'
                        }
                        end={this.state.label}
                        distinct
                    />

                    <NodeCypherLink
                        property='Group Delegated Object Control'
                        target={this.state.objectid}
                        baseQuery={
                            'MATCH p=(u:User {objectid: $objectid})-[r1:MemberOf*1..]->(g:Group)-[r2]->(n) WHERE r2.isacl=true'
                        }
                        start={this.state.label}
                        distinct
                    />

                    <NodePlayCypherLink
                        property='Transitive Object Control'
                        target={this.state.objectid}
                        baseQuery={
                            'MATCH (n) WHERE NOT n.objectid=$objectid MATCH p=shortestPath((u:User {objectid: $objectid})-[r1:MemberOf|AddMember|AllExtendedRights|ForceChangePassword|GenericAll|GenericWrite|WriteDacl|WriteOwner|Owns*1..]->(n))'
                        }
                        start={this.state.label}
                        distinct
                    />

                    <h4>Inbound Object Control</h4>

                    <NodeCypherLink
                        property='Explicit Object Controllers'
                        target={this.state.objectid}
                        baseQuery={
                            'MATCH p=(n)-[r]->(u1:User {objectid: $objectid}) WHERE r.isacl=true'
                        }
                        end={this.state.label}
                        distinct
                    />

                    <NodeCypherLink
                        property='Unrolled Object Controllers'
                        target={this.state.objectid}
                        baseQuery={
                            'MATCH p=(n)-[r:MemberOf*1..]->(g:Group)-[r1:AddMember|AllExtendedRights|GenericAll|GenericWrite|WriteDacl|WriteOwner|Owns]->(u:User {objectid: $objectid}) WITH LENGTH(p) as pathLength, p, n WHERE NONE (x in NODES(p)[1..(pathLength-1)] WHERE x.objectid = u.objectid) AND NOT n.objectid = u.objectid'
                        }
                        end={this.state.label}
                        distinct
                    />

                    <NodePlayCypherLink
                        property='Transitive Object Controllers'
                        target={this.state.objectid}
                        baseQuery={
                            'MATCH (n) WHERE NOT n.objectid=$objectid MATCH p = shortestPath((n)-[r1:MemberOf|AllExtendedRights|ForceChangePassword|GenericAll|GenericWrite|WriteDacl|WriteOwner*1..]->(u1:User {objectid: $objectid}))'
                        }
                        end={this.state.label}
                        distinct
                    />
                </dl>
                <div>
                    <h4 className={'inline'}>Notes</h4>
                    <i
                        ref='complete'
                        className='fa fa-check-circle green-icon-color notes-check-style'
                    />
                </div>
                <textarea
                    onBlur={this.notesBlur.bind(this)}
                    onChange={this.notesChanged.bind(this)}
                    value={this.state.notes === null ? '' : this.state.notes}
                    className={'node-notes-textarea'}
                    ref='notes'
                />
                <div>
                    <h4 className={'inline'}>Pictures</h4>
                    <i
                        ref='piccomplete'
                        className='fa fa-check-circle green-icon-color notes-check-style'
                    />
                </div>
                {gallery}
            </div>
        );
    }
}

UserNodeData.propTypes = {
    visible: PropTypes.bool.isRequired,
};

export default withAlert()(UserNodeData);