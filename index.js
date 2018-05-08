/* eslint class-methods-use-this: 0 */
import fetch from 'isomorphic-fetch';

export default class FreeSound {
  authHeader = '';

  clientId = '';

  clientSecret = '';

  host = 'freesound.org';

  uris = {
    base: `https://${this.host}/apiv2`,
    textSearch: '/search/text/',
    contentSearch: '/search/content/',
    combinedSearch: '/sounds/search/combined/',
    sound: '/sounds/<sound_id>/',
    soundAnalysis: '/sounds/<sound_id>/analysis/',
    similarSounds: '/sounds/<sound_id>/similar/',
    comments: '/sounds/<sound_id>/comments/',
    download: '/sounds/<sound_id>/download/',
    upload: '/sounds/upload/',
    describe: '/sounds/<sound_id>/describe/',
    pending: '/sounds/pending_uploads/',
    bookmark: '/sounds/<sound_id>/bookmark/',
    rate: '/sounds/<sound_id>/rate/',
    comment: '/sounds/<sound_id>/comment/',
    authorize: '/oauth2/authorize/',
    logout: '/api-auth/logout/',
    logoutAuthorize: '/oauth2/logout_and_authorize/',
    me: '/me/',
    user: '/users/<username>/',
    userSounds: '/users/<username>/sounds/',
    userPacks: '/users/<username>/packs/',
    userBookmarkCategories: '/users/<username>/bookmark_categories/',
    userBookmarkCategorySounds:
      '/users/<username>/bookmark_categories/<category_id>/sounds/',
    pack: '/packs/<pack_id>/',
    packSounds: '/packs/<pack_id>/sounds/',
    packDownload: '/packs/<pack_id>/download/'
  };

  checkOauth() {
    if (!this.authHeader.includes('Bearer')) {
      throw new Error('Oauth authentication required');
    }
  }

  makeFD(obj, fd) {
    if (!fd) {
      fd = new FormData();
    }
    for (const prop in obj) {
      fd.append(prop, obj[prop]);
    }
    return fd;
  }

  search(options, uri, success, error, wrapper) {
    if (options.analysis_file) {
      this.makeRequest(
        this.makeUri(uri),
        success,
        error,
        null,
        wrapper,
        'POST',
        makeFD(options)
      );
    } else {
      this.makeRequest(this.makeUri(uri), success, error, options, wrapper);
    }
  }

  Collection(oldJsonObject) {
    const jsonObject = { ...oldJsonObject };
    const nextOrPrev = (which, success, error) => {
      this.makeRequest(which, success, error, {}, this.Collection);
    };
    jsonObject.nextPage = (success, error) => {
      nextOrPrev(jsonObject.next, success, error);
    };
    jsonObject.previousPage = (success, error) => {
      nextOrPrev(jsonObject.previous, success, error);
    };
    jsonObject.getItem = idx => jsonObject.results[idx];

    return jsonObject;
  }

  SoundCollection(jsonObject) {
    const collection = this.Collection(jsonObject);
    collection.getSound = idx => new SoundObject(collection.results[idx]);
    return collection;
  }

  PackCollection(jsonObject) {
    const collection = this.Collection(jsonObject);
    collection.getPack = idx => new PackObject(collection.results[idx]);
    return collection;
  }

  SoundObject(oldJsonObject) {
    const jsonObject = { ...oldJsonObject };
    jsonObject.getAnalysis = (filter, success, error) => {
      this.makeRequest(
        this.makeUri(this.uris.soundAnalysis, [jsonObject.id, filter || '']),
        success,
        error
      );
    };

    jsonObject.getSimilar = (success, error, params) => {
      this.makeRequest(
        this.makeUri(this.uris.similarSounds, [jsonObject.id]),
        success,
        error,
        params,
        SoundCollection
      );
    };

    jsonObject.getComments = (success, error) => {
      this.makeRequest(
        this.makeUri(this.uris.comments, [jsonObject.id]),
        success,
        error,
        {},
        Collection
      );
    };

    jsonObject.download = (targetWindow) => {
      // can be window, new, or iframe
      this.checkOauth();
      const uri = this.makeUri(this.uris.download, [jsonObject.id]);
      targetWindow.location = uri;
    };

    jsonObject.comment = (commentStr, success, error) => {
      this.checkOauth();
      const data = new FormData();
      data.append('comment', comment);
      const uri = this.makeUri(this.uris.comment, [jsonObject.id]);
      this.makeRequest(uri, success, error, {}, null, 'POST', data);
    };

    jsonObject.rate = (rating, success, error) => {
      this.checkOauth();
      const data = new FormData();
      data.append('rating', rating);
      const uri = this.makeUri(this.uris.rate, [jsonObject.id]);
      this.makeRequest(uri, success, error, {}, null, 'POST', data);
    };

    jsonObject.bookmark = (name, category, success, error) => {
      this.checkOauth();
      const data = new FormData();
      data.append('name', name);
      if (category) {
        data.append('category', category);
      }
      const uri = this.makeUri(this.uris.bookmark, [jsonObject.id]);
      this.makeRequest(uri, success, error, {}, null, 'POST', data);
    };

    jsonObject.edit = (description, success, error) => {
      this.checkOauth();
      const data = this.makeFD(description);
      const uri = this.makeUri(this.uris.edit, [jsonObject.id]);
      this.makeRequest(uri, success, error, {}, null, 'POST', data);
    };

    return jsonObject;
  }
  UserObject(jsonObject) {
    jsonObject.sounds = (success, error, params) => {
      const uri = this.makeUri(this.uris.userSounds, [jsonObject.username]);
      this.makeRequest(uri, success, error, params, SoundCollection);
    };

    jsonObject.packs = (success, error) => {
      const uri = this.makeUri(this.uris.userPacks, [jsonObject.username]);
      this.makeRequest(uri, success, error, {}, PackCollection);
    };

    jsonObject.bookmarkCategories = (success, error) => {
      const uri = this.makeUri(this.uris.userBookmarkCategories, [
        jsonObject.username
      ]);
      this.makeRequest(uri, success, error);
    };

    jsonObject.bookmarkCategorySounds = (success, error, params) => {
      const uri = this.makeUri(this.uris.userBookmarkCategorySounds, [
        jsonObject.username
      ]);
      this.makeRequest(uri, success, error, params);
    };

    return jsonObject;
  }

  PackObject(jsonObject) {
    jsonObject.sounds = (success, error) => {
      const uri = this.makeUri(this.uris.packSounds, [jsonObject.id]);
      this.makeRequest(uri, success, error, {}, SoundCollection);
    };

    jsonObject.download = (targetWindow) => {
      // can be current or new window, or iframe
      this.checkOauth();
      const uri = this.makeUri(this.uris.packDownload, [jsonObject.id]);
      targetWindow.location = uri;
    };
    return jsonObject;
  }

  setToken(token, type) {
    authHeader = (type === 'oauth' ? 'Bearer ' : 'Token ') + token;
  }

  setClientSecrets(id, secret) {
    clientId = id;
    clientSecret = secret;
  }

  postAccessCode(code, success, error) {
    const post_url = `${uris.base}/oauth2/access_token/`;
    const data = new FormData();
    data.append('client_id', clientId);
    data.append('client_secret', clientSecret);
    data.append('code', code);
    data.append('grant_type', 'authorization_code');

    if (!success) {
      success = (result) => {
        setToken(result.access_token, 'oauth');
      };
    }
    this.makeRequest(post_url, success, error, {}, null, 'POST', data);
  }

  textSearch(query, options = {}, success, error) {
    options.query = query || ' ';
    search(options, uris.textSearch, success, error, SoundCollection);
  }

  contentSearch(options, success, error) {
    if (!(options.target || options.analysis_file)) {
      throw 'Missing target or analysis_file';
    }
    search(options, uris.contentSearch, success, error, SoundCollection);
  }

  combinedSearch(options, success, error) {
    if (!(options.target || options.analysis_file || options.query)) {
      throw 'Missing query, target or analysis_file';
    }
    search(options, uris.contentSearch, success, error);
  }

  getSound(soundId, success, error) {
    this.makeRequest(
      this.makeUri(this.uris.sound, [soundId]),
      success,
      error,
      {},
      SoundObject
    );
  }

  upload(audiofile, filename, description, success, error) {
    this.checkOauth();
    let fd = new FormData();
    fd.append('audiofile', audiofile, filename);
    if (description) {
      fd = this.makeFD(description, fd);
    }
    this.makeRequest(
      this.makeUri(this.uris.upload),
      success,
      error,
      {},
      null,
      'POST',
      fd
    );
  }

  describe(upload_filename, description, license, tags, success, error) {
    this.checkOauth();
    const fd = this.makeFD(description);
    this.makeRequest(
      this.makeUri(this.uris.upload),
      success,
      error,
      {},
      null,
      'POST',
      fd
    );
  }

  getPendingSounds(success, error) {
    this.checkOauth();
    this.makeRequest(this.makeUri(this.uris.pending), success, error, {});
  }

  // user resources
  me(success, error) {
    this.checkOauth();
    this.makeRequest(this.makeUri(this.uris.me), success, error);
  }

  getLoginURL() {
    if (this.clientId === undefined) throw new Error('client_id was not set');
    let loginUrl = this.makeUri(this.uris.authorize);
    loginUrl += `?client_id=${this.clientId}&response_type=code`;
    return loginUrl;
  }

  getLogoutURL() {
    let logoutUrl = this.makeUri(this.uris.logoutAuthorize);
    logoutUrl += `?client_id=${this.clientId}&response_type=code`;

    return logoutUrl;
  }

  getUser(username, success, error) {
    this.makeRequest(
      this.makeUri(this.uris.user, [username]),
      success,
      error,
      {},
      this.UserObject
    );
  }

  getPack(packId, success, error) {
    this.makeRequest(
      this.makeUri(this.uris.pack, [packId]),
      success,
      error,
      {},
      this.PackObject
    );
  }

  makeUri(uri, args) {
    for (const a in args) {
      uri = uri.replace(/<[\w_]+>/, args[a]);
    }
    return this.uris.base + uri;
  }

  async makeRequest() {
    const result = await fetch(uri, {
      method: method || 'GET',
      body: JSON.stringify(params),
      headers: {
        headers: { Authorization: authHeader }
      }
    }).then(res => res.json());
  }
}
