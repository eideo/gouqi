import { take, put, call, fork, select } from 'redux-saga/effects'
import {
  AsyncStorage,
  InteractionManager
} from 'react-native'
import * as api from '../services/api'
import { getCookies } from '../services/request'
import { Action } from 'redux-actions'
import {
  IUserInfo,
  ISearchState
} from '../interfaces'
import {
  toastAction
} from '../actions'
import {
  syncMoreResource,
  syncSearchResource
} from './common'
import {
  IPlaylists
} from '../reducers/detail'
import { isEmpty } from 'lodash'

export function* loginFlow () {
  while (true) {
    const { payload = {
      username: '',
      password: ''
    } }: Action<IUserInfo> = yield take('user/login')
    const { username, password } = payload

    if (username && password) {
      yield put({
        type: 'user/login/start'
      })

      const userInfo = yield call(api.login, username.trim(), password.trim())

      yield put({
        type: 'user/login/end'
      })

      if (userInfo.code === 200) {
        yield put(toastAction('success', '您已成功登录'))
        yield AsyncStorage.setItem('Cookies', getCookies())
      } else {
        yield put(toastAction('warning', '帐号或密码错误'))
      }
    } else {
      yield put(toastAction('warning', '帐号或密码不能为空'))
    }
  }
}

const searchPageOrder = ['song', 'playlist', 'artist', 'album']

function* requestSearch () {
  const prevState = yield select((state: any) => state.search)

  const key = searchPageOrder[prevState.activeTab]

  yield put({
    type: `search/${key}/query`
  })

  const { [key]: { query } }  = yield select((state: any) => state.search)

  if (query && query !== prevState[key].query) {
    yield put({
      type: `search/${searchPageOrder[prevState.activeTab]}`
    })
  }
}

export function* searchQuerying () {
  while (true) {
    yield take('search/query')

    yield *requestSearch()
  }
}

export function* changeSearchActiveTab () {
  while (true) {
    yield take('search/activeTab')

    yield *requestSearch()
  }
}

export function* syncSearchSongs () {
  while (true) {
    yield *syncSearchResource(
      api.SearchType.song,
      'song',
      '',
    )
  }
}

export function* syncSearchPlaylists () {
  while (true) {
    yield *syncSearchResource(
      api.SearchType.playList,
      'playlist',
      'coverImgUrl'
    )
  }
}

export function* syncSearchArtist () {
  while (true) {
    yield *syncSearchResource(
      api.SearchType.artist,
      'artist',
      'img1v1Url'
    )
  }
}

export function* syncSearchAlbums () {
  while (true) {
    yield *syncSearchResource(
      api.SearchType.album,
      'album',
      'picUrl'
    )
  }
}

export function* syncPlaylists () {
  while (true) {
    yield *syncMoreResource(
      'playlists/sync',
      'playlists',
      api.topPlayList,
      (state: any) => state.playlist,
      (result: any) => result.playlists
    )
    // yield take('playlists/sync')

    // yield put({
    //   type: 'playlists/sync/start'
    // })

    // const { more, offset, playlists }: IPlaylistsProps = yield select((state: any) => state.playlist)

    // if (more) {
    //   const offsetState = offset + 15
    //   const result: api.ItopPlayListResult = yield call(
    //     api.topPlayList, '15', offsetState.toString()
    //   )

    //   yield put({
    //     type: 'playlists/sync/save',
    //     payload: playlists.concat(result.playlists.map(p => {
    //       return Object.assign({}, p, {
    //         coverImgUrl: p.coverImgUrl + '?param=100y100'
    //       })
    //     })),
    //     meta: {
    //       more: result.more,
    //       offset: offsetState
    //     }
    //   })
    // } else {
    //   yield put(toastAction('info', '没有更多资源了'))
    // }

    // yield put({
    //   type: 'playlists/sync/end'
    // })
  }
}

export function* syncPlaylistDetail () {
  while (true) {
    const { payload }: { payload: number } = yield take('details/playlist')

    const playlist: api.IPlaylist = yield select((state: any) => state.details.playlist[payload])

    const isCached = !isEmpty(playlist)

    if ( !isCached ) {
      yield put({
        type: 'details/playlist/start'
      })
    }

    try {
      const response = yield call(api.playListDetail, payload.toString())

      yield call(InteractionManager.runAfterInteractions)

      if (response.code === 200) {
        const { result }: { result: api.IPlaylist } = response
        if (Array.isArray(result.tracks)) {
          result.tracks.forEach(track => track.album.picUrl += '?param=50y50')
          yield put({
            type: 'details/playlist/save',
            payload: {
              [payload]: result
            }
          })
        }
      }
    } catch (error) {
      yield put(toastAction('error', '网络出现错误...'))
    } finally {
      yield put({
        type: 'details/playlist/end'
      })
    }

  }
}

export function* subscribePlaylist () {
  while (true) {
    const { payload }: { payload: number } = yield take('details/playlist/subscribe')

    const playlist: api.IPlaylist = yield select((state: any) => state.details.playlist[payload])

    const { subscribed, subscribedCount } = playlist

    yield put({
      type: 'details/subscribe/start'
    })

    try {
      const response = yield call(api.subscribePlaylist, payload.toString(), !subscribed)
      if (response.code === 200) {
        const count = subscribed ? subscribedCount - 1 : subscribedCount + 1
        yield put({
          type: 'details/playlist/save',
          payload: {
            [payload]: {
              ...playlist,
              subscribedCount: count,
              subscribed: !subscribed
            }
          }
        })
      }
    } catch (error) {
      yield put(toastAction('error', '网络出现错误...'))
    }

    yield put({
      type: 'details/subscribe/end'
    })
  }
}

export function* syncComments () {
  const { payload } = yield take('comments/sync')

  const commentState: api.IComments = yield select((state: any) => {
    return state.comment.comments[payload.id] || {
      comments: [],
      hotComments: [],
      offset: 0
    }
  })

  const isCached = !isEmpty(commentState.comments)

  const offsetState = commentState.offset + 50

  if (!isCached || payload.loading) {
    yield put({
      type: 'comments/sync/start'
    })
  }

  try {
    const response: api.IComments = yield call(
      api.getComments,
      payload.id,
      '50',
      commentState.offset === 0 ? '0' : offsetState.toString()
    )

    console.log(response)

    yield put({
      type: 'comments/sync/save',
      payload: {
        [payload.id]: {
          ...response,
          offset: offsetState
        }
      }
    })
  } catch (error) {
    yield put(toastAction('error', '网络出现错误...'))
  } finally {
    yield put({
      type: 'comments/sync/end'
    })
  }
}

export default function* root () {
  yield [
    fork(loginFlow),
    fork(syncPlaylists),
    fork(syncSearchPlaylists),
    fork(syncSearchSongs),
    fork(syncSearchAlbums),
    fork(syncSearchArtist),
    fork(searchQuerying),
    fork(changeSearchActiveTab),
    fork(syncPlaylistDetail),
    fork(subscribePlaylist),
    fork(syncComments)
  ]
}
