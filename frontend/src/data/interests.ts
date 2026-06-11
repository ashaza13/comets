export interface InterestNode {
  id: string
  label: string
  children?: InterestNode[]
}

export const INTEREST_TREE: InterestNode = {
  id: 'root',
  label: 'Interests',
  children: [
    {
      id: 'music',
      label: 'Music',
      children: [
        {
          id: 'electronic',
          label: 'Electronic',
          children: [
            {
              id: 'house',
              label: 'House',
              children: [
                { id: 'deep_house', label: 'Deep House' },
                { id: 'melodic_house', label: 'Melodic House' },
                { id: 'tech_house', label: 'Tech House' },
                { id: 'acid_house', label: 'Acid House' },
                { id: 'progressive_house', label: 'Progressive House' },
              ],
            },
            {
              id: 'techno',
              label: 'Techno',
              children: [
                { id: 'detroit_techno', label: 'Detroit Techno' },
                { id: 'minimal_techno', label: 'Minimal Techno' },
                { id: 'industrial_techno', label: 'Industrial Techno' },
                { id: 'acid_techno', label: 'Acid Techno' },
              ],
            },
            {
              id: 'ambient',
              label: 'Ambient',
              children: [
                { id: 'dark_ambient', label: 'Dark Ambient' },
                { id: 'space_ambient', label: 'Space Ambient' },
                { id: 'drone', label: 'Drone' },
                { id: 'new_age', label: 'New Age' },
              ],
            },
            {
              id: 'dnb',
              label: 'Drum & Bass',
              children: [
                { id: 'liquid_dnb', label: 'Liquid DnB' },
                { id: 'neurofunk', label: 'Neurofunk' },
                { id: 'jump_up', label: 'Jump Up' },
              ],
            },
            {
              id: 'trance',
              label: 'Trance',
              children: [
                { id: 'psytrance', label: 'Psytrance' },
                { id: 'progressive_trance', label: 'Prog Trance' },
                { id: 'uplifting_trance', label: 'Uplifting Trance' },
              ],
            },
            { id: 'idm', label: 'IDM' },
            { id: 'dubstep', label: 'Dubstep' },
          ],
        },
        {
          id: 'jazz',
          label: 'Jazz',
          children: [
            { id: 'bebop', label: 'Bebop' },
            { id: 'cool_jazz', label: 'Cool Jazz' },
            { id: 'fusion', label: 'Fusion' },
            { id: 'modal_jazz', label: 'Modal Jazz' },
            { id: 'nu_jazz', label: 'Nu-Jazz' },
            { id: 'free_jazz', label: 'Free Jazz' },
          ],
        },
        {
          id: 'classical',
          label: 'Classical',
          children: [
            { id: 'baroque', label: 'Baroque' },
            { id: 'romantic', label: 'Romantic' },
            { id: 'contemporary_classical', label: 'Contemporary' },
            { id: 'chamber', label: 'Chamber Music' },
            { id: 'opera', label: 'Opera' },
          ],
        },
        {
          id: 'hip_hop',
          label: 'Hip-Hop',
          children: [
            { id: 'trap', label: 'Trap' },
            { id: 'boom_bap', label: 'Boom Bap' },
            { id: 'lofi', label: 'Lo-Fi' },
            { id: 'conscious_hiphop', label: 'Conscious' },
            { id: 'drill', label: 'Drill' },
          ],
        },
        {
          id: 'rock',
          label: 'Rock',
          children: [
            { id: 'indie_rock', label: 'Indie Rock' },
            { id: 'prog_rock', label: 'Prog Rock' },
            { id: 'post_rock', label: 'Post-Rock' },
            { id: 'shoegaze', label: 'Shoegaze' },
            {
              id: 'metal',
              label: 'Metal',
              children: [
                { id: 'black_metal', label: 'Black Metal' },
                { id: 'death_metal', label: 'Death Metal' },
                { id: 'doom_metal', label: 'Doom Metal' },
                { id: 'post_metal', label: 'Post-Metal' },
              ],
            },
            { id: 'punk', label: 'Punk' },
          ],
        },
        {
          id: 'folk_world',
          label: 'Folk & World',
          children: [
            { id: 'folk_music', label: 'Folk' },
            { id: 'blues', label: 'Blues' },
            { id: 'reggae', label: 'Reggae' },
            { id: 'afrobeats', label: 'Afrobeats' },
            { id: 'latin_music', label: 'Latin' },
          ],
        },
        {
          id: 'experimental',
          label: 'Experimental',
          children: [
            { id: 'noise', label: 'Noise' },
            { id: 'avant_garde', label: 'Avant-Garde' },
            { id: 'musique_concrete', label: 'Musique Concrète' },
            { id: 'electroacoustic', label: 'Electroacoustic' },
          ],
        },
      ],
    },
    {
      id: 'technology',
      label: 'Technology',
      children: [
        { id: 'programming', label: 'Programming' },
        { id: 'ai_ml', label: 'AI & ML' },
        { id: 'hardware', label: 'Hardware' },
        { id: 'cybersecurity', label: 'Cybersecurity' },
        { id: 'open_source', label: 'Open Source' },
        { id: 'gaming', label: 'Gaming' },
      ],
    },
    {
      id: 'visual_arts',
      label: 'Visual Arts',
      children: [
        { id: 'photography', label: 'Photography' },
        { id: 'painting', label: 'Painting' },
        { id: 'graphic_design', label: 'Graphic Design' },
        { id: 'architecture', label: 'Architecture' },
        { id: 'digital_art', label: 'Digital Art' },
        { id: 'film', label: 'Film' },
      ],
    },
    {
      id: 'sports',
      label: 'Sports',
      children: [
        { id: 'endurance', label: 'Endurance' },
        { id: 'team_sports', label: 'Team Sports' },
        { id: 'martial_arts', label: 'Martial Arts' },
        { id: 'extreme_sports', label: 'Extreme Sports' },
        { id: 'athletics', label: 'Athletics' },
      ],
    },
    {
      id: 'food_cooking',
      label: 'Food',
      children: [
        { id: 'cooking', label: 'Cooking' },
        { id: 'wine', label: 'Wine' },
        { id: 'coffee', label: 'Coffee' },
        { id: 'world_cuisine', label: 'World Cuisines' },
        { id: 'baking', label: 'Baking' },
      ],
    },
    {
      id: 'science',
      label: 'Science',
      children: [
        { id: 'physics', label: 'Physics' },
        { id: 'biology', label: 'Biology' },
        { id: 'mathematics', label: 'Mathematics' },
        { id: 'astronomy', label: 'Astronomy' },
        { id: 'neuroscience', label: 'Neuroscience' },
        { id: 'psychology', label: 'Psychology' },
      ],
    },
    {
      id: 'literature',
      label: 'Literature',
      children: [
        { id: 'fiction', label: 'Fiction' },
        { id: 'philosophy', label: 'Philosophy' },
        { id: 'poetry', label: 'Poetry' },
        { id: 'non_fiction', label: 'Non-Fiction' },
        { id: 'sci_fi', label: 'Sci-Fi' },
      ],
    },
    {
      id: 'nature',
      label: 'Nature',
      children: [
        { id: 'hiking', label: 'Hiking' },
        { id: 'wildlife', label: 'Wildlife' },
        { id: 'astronomy_nature', label: 'Stargazing' },
        { id: 'gardening', label: 'Gardening' },
        { id: 'ecology', label: 'Ecology' },
      ],
    },
  ],
}

export function getNodeAtPath(root: InterestNode, path: string[]): InterestNode | null {
  let node = root
  for (const id of path) {
    const child = node.children?.find((c) => c.id === id)
    if (!child) return null
    node = child
  }
  return node
}

export function getBreadcrumbLabels(path: string[], root: InterestNode): string[] {
  const labels: string[] = []
  let node = root
  for (const id of path) {
    const child = node.children?.find((c) => c.id === id)
    if (!child) break
    labels.push(child.label)
    node = child
  }
  return labels
}
