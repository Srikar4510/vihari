// High-resolution photos from Wikimedia Commons, served from Wikimedia's CDN.
// Their CC BY / CC BY-SA / FAL licenses require crediting the author; see PhotoCredits.jsx.
const thumb = (path, file) => `https://upload.wikimedia.org/wikipedia/commons/thumb/${path}/${file}/1280px-${file}`;

export const PHOTOS = {
  agra: {
    src: thumb('b/b2', 'Taj_Mahal_Tomb_at_sunrise.JPG'),
    title: 'Taj Mahal at sunrise', author: 'MarcBW', license: 'CC BY-SA 3.0',
    page: 'https://commons.wikimedia.org/wiki/File:Taj_Mahal_Tomb_at_sunrise.JPG',
  },
  hyderabad: {
    src: thumb('b/be', 'The_Charminar_on_a_cloudy_day.jpg'),
    title: 'Charminar', author: 'Santosh Kumar Velamala', license: 'CC BY-SA 4.0',
    page: 'https://commons.wikimedia.org/wiki/File:The_Charminar_on_a_cloudy_day.jpg',
  },
  delhi: {
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Lahori_Gate%2C_Red_Fort%2C_Delhi%2C_India_-_September_2014.jpg/1280px-Lahori_Gate%2C_Red_Fort%2C_Delhi%2C_India_-_September_2014.jpg',
    title: 'Red Fort', author: 'Rickard Törnblad', license: 'CC BY-SA 4.0',
    page: 'https://commons.wikimedia.org/wiki/File:Lahori_Gate,_Red_Fort,_Delhi,_India_-_September_2014.jpg',
  },
  delhiPortrait: {
    src: thumb('5/57', 'Qutub_Minar_in_Delhi_03-2016.jpg'),
    title: 'Qutub Minar', author: 'A.Savin', license: 'FAL',
    page: 'https://commons.wikimedia.org/wiki/File:Qutub_Minar_in_Delhi_03-2016.jpg',
  },
  mumbai: {
    src: thumb('1/1e', 'Mumbai%2C_Taj_Hotel%2C_Gateway_of_India_%286362182215%29.jpg'),
    title: 'Gateway of India', author: 'Arian Zwegers', license: 'CC BY 2.0',
    page: 'https://commons.wikimedia.org/wiki/File:Mumbai,_Taj_Hotel,_Gateway_of_India_(6362182215).jpg',
  },
  chennai: {
    src: thumb('d/d2', 'Chennai_train_station.jpg'),
    title: 'Chennai Central', author: 'Arian Zwegers', license: 'CC BY 2.0',
    page: 'https://commons.wikimedia.org/wiki/File:Chennai_train_station.jpg',
  },
  goa: {
    src: thumb('b/b6', 'Palolem_beach%2C_Goa_-_panoramio.jpg'),
    title: 'Palolem Beach', author: 'Biswajit Majumdar', license: 'CC BY-SA 3.0',
    page: 'https://commons.wikimedia.org/wiki/File:Palolem_beach,_Goa_-_panoramio.jpg',
  },
  bangalore: {
    src: thumb('f/f4', 'Vidhana_Soudha_LE.jpg'),
    title: 'Vidhana Soudha', author: 'DeepanjanGhosh', license: 'CC BY-SA 4.0',
    page: 'https://commons.wikimedia.org/wiki/File:Vidhana_Soudha_LE.jpg',
  },
};
