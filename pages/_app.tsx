
// insert global css here
// ref: https://github.com/zeit/next.js/blob/master/errors/css-global.md
import './component/style/default.scss'

export default ({ Component, pageProps }) => {
  return <Component {...pageProps} />
}
