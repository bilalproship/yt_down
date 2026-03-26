import { Composition, registerRoot } from 'remotion'
import './style.css'
import { WordPopTemplate } from './templates/WordPopTemplate'

export const RemotionRoot = () => (
  <Composition
    id="WordPop"
    component={WordPopTemplate}
    durationInFrames={9000}
    fps={30}
    width={1920}
    height={180}
    defaultProps={{ segments: [], totalDurationSec: 60 }}
  />
)

registerRoot(RemotionRoot)
