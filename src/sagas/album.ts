import { put, select, call, takeLatest, takeEvery, all } from 'redux-saga/effects'
import {
  toastAction
} from '../actions'
import * as api from '../services/api'
import {
  InteractionManager
} from 'react-native'
import {
  ajaxCall,
  refreshResource,
  syncMoreResource
} from './common'

const refreshAlbums = refreshResource(
  'albums',
  api.newAlbums
)

const syncMoreAlbums = syncMoreResource(
  'albums',
  'album',
  api.newAlbums
)

function* syncAlbum ( { payload }: any ) {
  yield call(InteractionManager.runAfterInteractions)
  const album: api.IAlbum = yield select((state: any) => state.details.albums[payload])

  if (!album) {
    yield put({
      type: 'details/playlist/start'
    })
  }

  const [song, detail] = yield call(Promise.all, [
    api.albumInfo(payload.toString()),
    api.albumDetail(payload.toString())
  ])

  if (song.code === 200 && detail.code === 200) {
    yield put({
      type: 'details/album/save',
      payload: {
        [payload]: {
          ...song.album,
          description: detail.album.description
        }
      }
    })
  }

  yield put({
    type: 'details/playlist/end'
  })
}

export default function* watchAlbums () {
  yield all([
    takeLatest('albums/refresh', refreshAlbums),
    takeLatest('albums/sync', syncMoreAlbums),
    takeEvery('albums/detail', syncAlbum)
  ])
}
