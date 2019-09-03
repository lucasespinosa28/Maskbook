import { PersonIdentifier, PostIdentifier } from '../../../database/type'
import { parseFacebookStaticHTML } from '../parse-html'
import { getPostUrlAtFacebook } from '../parse-username'
import tasks from '../../../extension/content-script/tasks'
import { isDocument, timeout } from '../../../utils/utils'

// ? We now always run fetch request from an active tab.
// ? If failed, we will fallback to open a new tab to do this.
export async function fetchPostContentFacebook(post: PostIdentifier<PersonIdentifier>) {
    const activeTabID = await getActiveTab()
    if (activeTabID) {
        // Path 1: fetch by http req
        try {
            const url = getPostUrlAtFacebook(post, 'fetch')
            const html = await timeout(tasks(activeTabID).fetch(url), 5000)
            const doc = parseFacebookStaticHTML(html)
            if (!doc.length) throw new Error("Can't parse the page")
            // TODO: You should take care about the key comes from.
            //  If some one commented a key under a normal post,
            //  it will be a false-positive and it is dangerous.
            //  There is a build-in parser.
            //  Checkout http://mdn.io/DOMParser and we're already using it.

            const content = doc
                .map(x => (isDocument(x) ? x.body : x).innerText)
                .join('')
                .match(/(🔒.+🔒)/)
            if (content && content[0].length) return content[0]
            throw new Error('Not found in post')
        } catch (e) {
            console.log(e)
        }
    }
    // Path 2: fetch by tab task
    // TODO: on iOS, this should run the Path 1 in the domain of m.facebook.com
    // const tabId = await getActiveTab()
    return tasks(getPostUrlAtFacebook(post, 'open'), {
        // runAtTabID: tabId,
    }).getPostContent(post)
}

async function getActiveTab() {
    const [tab] = await browser.tabs.query({
        url: ['https://www.facebook.com/*', 'https://m.facebook.com/*'],
        pinned: false,
    })
    if (tab) return tab.id
    return undefined
}
