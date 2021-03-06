// tslint:disable-next-line:no-unused-variable
import * as React from 'react';
import Avatar from 'material-ui/Avatar';
import { ListItem } from 'material-ui/List';
import Star from 'material-ui/svg-icons/toggle/star';
import { grey700, pinkA200, transparent } from 'material-ui/styles/colors';
import { Observable } from 'rxjs/Observable';

import { Action } from './lib/action';
import { ChannelBase } from './lib/models/api-shapes';
import { IChannelList } from './channel-list';
import { fromObservable, Model } from './lib/model';
import { isDM } from './lib/models/slack-api';
import { SimpleView } from './lib/view';
import { Store } from './lib/store';
import { Updatable } from './lib/updatable';

import { when } from './lib/when';

import './lib/standard-operators';

const defaultAvatar = require.resolve('./images/default-avatar.png');

export class ChannelViewModel extends Model {
  selectChannel: Action<void>;

  @fromObservable model: ChannelBase;
  @fromObservable id: string;
  @fromObservable displayName: string;
  @fromObservable profileImage: string;
  @fromObservable mentions: number;
  @fromObservable highlighted: boolean;
  @fromObservable starred: boolean;

  constructor(public readonly store: Store, public readonly parent: IChannelList, model: Updatable<ChannelBase>) {
    super();

    model.toProperty(this, 'model');

    when(this, x => x.model.id).toProperty(this, 'id');
    when(this, x => x.model.is_starred).toProperty(this, 'starred');
    when(this, x => x.model.mention_count).toProperty(this, 'mentions');

    when(this, x => x.model)
      .filter(x => !!x)
      .switchMap(x => this.getDisplayName(x))
      .toProperty(this, 'displayName');

    when(this, x => x.model)
      .filter(c => !!c && isDM(c))
      .switchMap(c => {
        // XXX: This is a crime
        let u = this.store.users.listen(c.user_id, c.api);
        return u.do(x => {
          if (x && !x.profile) u.invalidate();
        });
      })
      .filter(x => x && !!x.profile)
      .map((user) => {
        if (!user) return defaultAvatar;
        return user.profile.image_72;
      })
      .toProperty(this, 'profileImage');

    when(this, x => x.mentions, x => x.model.has_unreads,
      (mentions, hasUnreads) => mentions > 0 || hasUnreads)
      .toProperty(this, 'highlighted');

    this.selectChannel = Action.create(() => {
      this.parent.setSelectedChannel(this.model);
    }, undefined);
  }

  private getDisplayName(c: ChannelBase): Observable<string> {
    // NB: This Feels Bad. We should be encouraging people to *create*
    // Updatables.

    let ret = Observable.of(c.name);

    if (isDM(c)) {
      ret = this.store.users.listen(c.user_id, c.api)
        .map(x => x ? (x.real_name || x.name) : c.name)
        .startWith(c.name);
    }

    return ret
      .filter(x => !!x)
      .map(x => x.length < 25 ? x : `${x.substr(0, 25)}...`);
  }
}

export class ChannelListItem extends SimpleView<ChannelViewModel> {
  render() {
    const viewModel = this.props.viewModel;
    const fontWeight = viewModel.highlighted ? 'bold' : 'normal';
    const offsetStyle = { top: '4px' };

    let leftAvatar = null;
    if (viewModel.starred) {
      leftAvatar = <Star style={offsetStyle} color={grey700}/>;
    } else if (viewModel.profileImage) {
      leftAvatar = (
        <Avatar
          src={viewModel.profileImage}
          style={offsetStyle}
          size={24}
        />
      );
    } else {
      leftAvatar = (
        <Avatar
          color={grey700} backgroundColor={transparent}
          style={offsetStyle}
          size={24}
        >
          #
        </Avatar>
      );
    }

    const mentionsBadge = viewModel.mentions > 0 ? (
      <Avatar
        backgroundColor={pinkA200}
        style={offsetStyle}
        size={24}
      >
        {viewModel.mentions}
      </Avatar>
    ) : null;

    return (
      <ListItem
        onTouchTap={viewModel.selectChannel.bind()}
        primaryText={viewModel.displayName}
        leftAvatar={leftAvatar}
        rightAvatar={mentionsBadge}
        style={{ fontWeight }}
        innerDivStyle={{ padding: '8px 8px 8px 60px' }}
      />
    );
  }
}
