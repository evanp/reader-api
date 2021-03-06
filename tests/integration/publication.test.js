const request = require('supertest')
const tap = require('tap')
const urlparse = require('url').parse
const {
  getToken,
  createUser,
  destroyDB,
  getActivityFromUrl
} = require('../utils/utils')
const _ = require('lodash')
const { urlToId } = require('../../utils/utils')
const { Attribution } = require('../../models/Attribution')
const { Document } = require('../../models/Document')
const { Reader } = require('../../models/Reader')
const { Tag } = require('../../models/Tag')
const { Publication_Tag } = require('../../models/Publications_Tags')

const test = async app => {
  if (!process.env.POSTGRE_INSTANCE) {
    await app.initialize()
  }

  const token = getToken()
  const readerCompleteUrl = await createUser(app, token)
  const readerUrl = urlparse(readerCompleteUrl).path

  // Create Reader object
  const person = {
    name: 'J. Random Reader'
  }

  const reader1 = await Reader.createReader(readerCompleteUrl, person)

  let publicationUrl
  let activityUrl

  const now = new Date().toISOString()

  await tap.test('Create Publication', async () => {
    const res = await request(app)
      .post(`${readerUrl}/activity`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )
      .send(
        JSON.stringify({
          '@context': [
            'https://www.w3.org/ns/activitystreams',
            { reader: 'https://rebus.foundation/ns/reader' }
          ],
          type: 'Create',
          object: {
            type: 'Publication',
            name: 'Publication A',
            author: ['John Smith'],
            editor: 'Jané S. Doe',
            description: 'this is a description!!',
            inLanguage: 'English',
            datePublished: now,
            links: [
              {
                '@context': 'https://www.w3.org/ns/activitystreams',
                href: 'http://example.org/abc',
                hreflang: 'en',
                mediaType: 'text/html',
                name: 'An example link'
              }
            ],
            readingOrder: [
              {
                '@context': 'https://www.w3.org/ns/activitystreams',
                href: 'http://example.org/abc',
                hreflang: 'en',
                mediaType: 'text/html',
                name: 'An example reading order object1'
              },
              {
                '@context': 'https://www.w3.org/ns/activitystreams',
                href: 'http://example.org/abc',
                hreflang: 'en',
                mediaType: 'text/html',
                name: 'An example reading order object2'
              },
              {
                '@context': 'https://www.w3.org/ns/activitystreams',
                href: 'http://example.org/abc',
                hreflang: 'en',
                mediaType: 'text/html',
                name: 'An example reading order object3'
              }
            ],
            resources: [
              {
                '@context': 'https://www.w3.org/ns/activitystreams',
                href: 'http://example.org/abc',
                hreflang: 'en',
                mediaType: 'text/html',
                name: 'An example resource'
              }
            ],
            json: { property: 'value' }
          }
        })
      )

    await tap.equal(res.status, 201)
    await tap.type(res.get('Location'), 'string')
    activityUrl = res.get('Location')
  })

  await tap.test('Create Simple Publication', async () => {
    const res = await request(app)
      .post(`${readerUrl}/activity`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )
      .send(
        JSON.stringify({
          '@context': [
            'https://www.w3.org/ns/activitystreams',
            { reader: 'https://rebus.foundation/ns/reader' }
          ],
          type: 'Create',
          object: {
            type: 'Publication',
            name: 'Publication A',
            readingOrder: [
              {
                '@context': 'https://www.w3.org/ns/activitystreams',
                href: 'http://example.org/abc',
                hreflang: 'en',
                mediaType: 'text/html',
                name: 'An example reading order object2'
              },
              {
                '@context': 'https://www.w3.org/ns/activitystreams',
                href: 'http://example.org/abc',
                hreflang: 'en',
                mediaType: 'text/html',
                name: 'An example reading order object'
              },
              {
                '@context': 'https://www.w3.org/ns/activitystreams',
                href: 'http://example.org/abc',
                hreflang: 'en',
                mediaType: 'text/html',
                name: 'An example reading order object3'
              }
            ]
          }
        })
      )

    await tap.equal(res.status, 201)
    await tap.type(res.get('Location'), 'string')
  })

  await tap.test('Get Publication', async () => {
    const activityObject = await getActivityFromUrl(app, activityUrl, token)
    publicationUrl = activityObject.object.id

    const res = await request(app)
      .get(urlparse(publicationUrl).path)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )
    await tap.equal(res.statusCode, 200)

    const body = res.body

    await tap.type(body, 'object')
    await tap.type(body.id, 'string')
    await tap.ok(body.id.endsWith('/'))
    await tap.equal(body.type, 'Publication')
    await tap.equal(body.name, 'Publication A')
    await tap.ok(_.isArray(body.author))
    await tap.equal(body.author[0].name, 'John Smith')
    await tap.equal(body.editor[0].name, 'Jané S. Doe')
    await tap.equal(body.description, 'this is a description!!')
    await tap.ok(body.datePublished)
    await tap.equal(body.links[0].name, 'An example link')
    await tap.equal(
      body.readingOrder[1].name,
      'An example reading order object2'
    )
    await tap.equal(body.resources[0].name, 'An example resource')
    await tap.equal(body.json.property, 'value')
    await tap.ok(body.readerId)
    await tap.ok(body.published)
    await tap.ok(body.updated)
    await tap.equal(body.inLanguage, 'English')
  })

  // await tap.test('Read activity should appear on the publication', async () => {
  //   await request(app)
  //     .post(`${readerUrl}/activity`)
  //     .set('Host', 'reader-api.test')
  //     .set('Authorization', `Bearer ${token}`)
  //     .type(
  //       'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
  //     )
  //     .send(
  //       JSON.stringify({
  //         '@context': [
  //           'https://www.w3.org/ns/activitystreams',
  //           { reader: 'https://rebus.foundation/ns/reader' },
  //           { oa: 'http://www.w3.org/ns/oa#' }
  //         ],
  //         type: 'Read',
  //         object: { type: 'Document', id: documentUrl },
  //         context: publicationUrl,
  //         'oa:hasSelector': {
  //           type: 'XPathSelector',
  //           value: '/html/body/p[2]/table/tr[2]/td[3]/span'
  //         }
  //       })
  //     )

  //   await request(app)
  //     .post(`${readerUrl}/activity`)
  //     .set('Host', 'reader-api.test')
  //     .set('Authorization', `Bearer ${token}`)
  //     .type(
  //       'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
  //     )
  //     .send(
  //       JSON.stringify({
  //         '@context': [
  //           'https://www.w3.org/ns/activitystreams',
  //           { reader: 'https://rebus.foundation/ns/reader' },
  //           { oa: 'http://www.w3.org/ns/oa#' }
  //         ],
  //         type: 'Read',
  //         object: { type: 'Document', id: documentUrl },
  //         context: publicationUrl,
  //         'oa:hasSelector': {
  //           type: 'XPathSelector',
  //           value: '/html/body/p[2]/table/tr[2]/td[3]/span2'
  //         }
  //       })
  //     )

  //   const activityObject = await getActivityFromUrl(app, activityUrl, token)
  //   publicationUrl = activityObject.object.id

  //   const res = await request(app)
  //     .get(urlparse(publicationUrl).path)
  //     .set('Host', 'reader-api.test')
  //     .set('Authorization', `Bearer ${token}`)
  //     .type(
  //       'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
  //     )
  //   await tap.equal(res.statusCode, 200)
  //   const body = res.body
  //   await tap.type(body, 'object')
  //   await tap.type(body.position, 'object')
  //   await tap.type(body.position.documentId, 'string')
  //   await tap.equal(body.position.documentId, documentUrl)
  //   await tap.type(body.position.value, 'string')
  //   await tap.equal(
  //     body.position.value,
  //     '/html/body/p[2]/table/tr[2]/td[3]/span2'
  //   )
  // })

  await tap.test('Get Publication that does not exist', async () => {
    const res = await request(app)
      .get(urlparse(publicationUrl).path + 'abc')
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )

    await tap.equal(res.statusCode, 404)
    const error = JSON.parse(res.text)
    await tap.equal(error.statusCode, 404)
    await tap.equal(error.error, 'Not Found')
    await tap.equal(error.details.type, 'Publication')
    await tap.type(error.details.id, 'string')
    await tap.equal(error.details.activity, 'Get Publication')
  })

  await tap.test('Update a publication', async () => {
    // const timestamp = new Date(2018, 01, 30).toISOString()
    const res = await request(app)
      .post(`${readerUrl}/activity`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )
      .send(
        JSON.stringify({
          '@context': [
            'https://www.w3.org/ns/activitystreams',
            { reader: 'https://rebus.foundation/ns/reader' }
          ],
          type: 'Update',
          object: {
            type: 'Publication',
            id: publicationUrl,
            name: 'New name for pub A',
            // datePublished: timestamp,
            description: 'New description for Publication',
            json: { property: 'New value for json property' },
            inLanguage: ['Swahili', 'French'],
            keywords: ['newKeyWord1', 'newKeyWord2'],
            author: [
              { type: 'Person', name: 'New Sample Author' },
              { type: 'Organization', name: 'New Org inc.' }
            ],
            editor: [{ type: 'Person', name: 'New Sample Editor' }]
          }
        })
      )

    await tap.equal(res.status, 201)
    await tap.type(res.get('Location'), 'string')

    activityUrl = res.get('Location')

    const activityObject = await getActivityFromUrl(app, activityUrl, token)
    const newPublicationUrl = activityObject.object.id

    const resPub = await request(app)
      .get(urlparse(newPublicationUrl).path)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )

    await tap.equal(resPub.statusCode, 200)

    const body = resPub.body

    const attributions = await Attribution.getAttributionByPubId(
      urlToId(body.id)
    )

    await tap.equal(body.name, 'New name for pub A')
    await tap.equal(body.description, 'New description for Publication')
    // await tap.equal(body.datePublished, timestamp)
    await tap.equal(body.json.property, 'New value for json property')
    await tap.equal(body.inLanguage[0], 'Swahili')
    await tap.equal(body.inLanguage[1], 'French')
    await tap.equal(body.keywords[0], 'newKeyWord1')
    await tap.equal(body.keywords[1], 'newKeyWord2')
    await tap.ok(
      body.author[0].name === 'New Org inc.' ||
        body.author[0].name === 'New Sample Author'
    )
    await tap.ok(
      body.author[1].name === 'New Org inc.' ||
        body.author[1].name === 'New Sample Author'
    )
    await tap.equal(body.editor[0].name, 'New Sample Editor')
    await tap.ok(attributions)
    await tap.ok(attributions[0] instanceof Attribution)
    await tap.equal(attributions.length, 3)
    await tap.ok(
      attributions[0].name === 'New Sample Author' ||
        attributions[0].name === 'New Org inc.' ||
        attributions[0].name === 'New Sample Editor'
    )
  })

  await tap.test('Update a Publication that does not exist', async () => {
    const res = await request(app)
      .post(`${readerUrl}/activity`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )
      .send(
        JSON.stringify({
          '@context': [
            'https://www.w3.org/ns/activitystreams',
            { reader: 'https://rebus.foundation/ns/reader' }
          ],
          type: 'Update',
          object: {
            type: 'Publication',
            id: publicationUrl + 'abc',
            name: 'New name for pub A',
            // datePublished: timestamp,
            description: 'New description for Publication',
            json: { property: 'New value for json property' },
            inLanguage: ['Swahili', 'French'],
            keywords: ['newKeyWord1', 'newKeyWord2'],
            author: [
              { type: 'Person', name: 'New Sample Author' },
              { type: 'Organization', name: 'New Org inc.' }
            ],
            editor: [{ type: 'Person', name: 'New Sample Editor' }]
          }
        })
      )

    const error = JSON.parse(res.text)
    await tap.equal(error.statusCode, 404)
    await tap.equal(error.error, 'Not Found')
    await tap.equal(error.details.type, 'Publication')
    await tap.type(error.details.id, 'string')
    await tap.equal(error.details.activity, 'Update Publication')
  })

  await tap.test('Delete Publication', async () => {
    // Create a Document for that publication
    const documentObject = {
      mediaType: 'txt',
      url: 'http://google-bucket/somewhere/file1234.txt',
      documentPath: '/inside/the/book.txt',
      json: { property1: 'value1' }
    }

    const document = await Document.createDocument(
      reader1,
      publicationUrl,
      documentObject
    )

    // Create a tag for testing purposes
    const createdTag = await Tag.createTag(reader1.id, {
      type: 'reader:Stack',
      name: 'mystack'
    })

    await Publication_Tag.addTagToPub(publicationUrl, createdTag.id)

    // before
    const before = await request(app)
      .get(`${readerUrl}/library`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )

    await tap.equal(before.body.items.length, 2)
    await tap.equal(before.body.items[1].tags.length, 1)
    await tap.equal(before.body.items[1].tags[0].name, 'mystack')
    await tap.ok(!document.deleted)

    const res = await request(app)
      .post(`${readerUrl}/activity`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )
      .send(
        JSON.stringify({
          '@context': [
            'https://www.w3.org/ns/activitystreams',
            { reader: 'https://rebus.foundation/ns/reader' }
          ],
          type: 'Delete',
          object: {
            type: 'Publication',
            id: publicationUrl
          }
        })
      )
    await tap.equal(res.statusCode, 204)

    // getting deleted publication should return 404 error
    const getres = await request(app)
      .get(urlparse(publicationUrl).path)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )

    await tap.equal(getres.statusCode, 404)
    const error = JSON.parse(getres.text)
    await tap.equal(error.statusCode, 404)
    await tap.equal(error.error, 'Not Found')
    await tap.equal(error.details.type, 'Publication')
    await tap.type(error.details.id, 'string')

    // publication should no longer be in the reader library
    const libraryres = await request(app)
      .get(`${readerUrl}/library`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )

    // Make sure documents associated with the publication are deleted
    const deletedDoc = await Document.byId(document.id)
    await tap.ok(deletedDoc.deleted)

    await tap.equal(libraryres.status, 200)
    const body = libraryres.body
    await tap.ok(Array.isArray(body.items))
    await tap.equal(body.items.length, 1)
    await tap.equal(body.items[0].tags.length, 0)
  })

  await tap.test('delete publication that does not exist', async () => {
    // already deleted
    const res = await request(app)
      .post(`${readerUrl}/activity`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )
      .send(
        JSON.stringify({
          '@context': [
            'https://www.w3.org/ns/activitystreams',
            { reader: 'https://rebus.foundation/ns/reader' }
          ],
          type: 'Delete',
          object: {
            type: 'Publication',
            id: publicationUrl
          }
        })
      )
    await tap.equal(res.statusCode, 404)
    const error = JSON.parse(res.text)
    await tap.equal(error.statusCode, 404)
    await tap.equal(error.error, 'Not Found')
    await tap.equal(error.details.type, 'Publication')
    await tap.type(error.details.id, 'string')
    await tap.equal(error.details.activity, 'Delete Publication')

    // never existed
    const res1 = await request(app)
      .post(`${readerUrl}/activity`)
      .set('Host', 'reader-api.test')
      .set('Authorization', `Bearer ${token}`)
      .type(
        'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
      )
      .send(
        JSON.stringify({
          '@context': [
            'https://www.w3.org/ns/activitystreams',
            { reader: 'https://rebus.foundation/ns/reader' }
          ],
          type: 'Delete',
          object: {
            type: 'Publication',
            id: publicationUrl + '123'
          }
        })
      )
    await tap.equal(res1.statusCode, 404)
    const error1 = JSON.parse(res1.text)
    await tap.equal(error1.statusCode, 404)
    await tap.equal(error1.error, 'Not Found')
    await tap.equal(error1.details.type, 'Publication')
    await tap.type(error1.details.id, 'string')
    await tap.equal(error1.details.activity, 'Delete Publication')
  })

  if (!process.env.POSTGRE_INSTANCE) {
    await app.terminate()
  }
  await destroyDB(app)
}

module.exports = test
