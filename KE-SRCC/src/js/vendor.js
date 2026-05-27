import $ from 'jquery';
import Swiper from 'swiper';
import { Navigation, Pagination, Autoplay } from 'swiper/modules';
import { gsap } from 'gsap';
import flatpickr from 'flatpickr';

import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import 'flatpickr/dist/flatpickr.min.css';
// import 'flatpickr/dist/themes/material_blue.css';
// import 'flatpickr/dist/themes/material_green.css';
// import 'flatpickr/dist/themes/airbnb.css';
// import 'flatpickr/dist/themes/light.css';
import 'flatpickr/dist/themes/dark.css';

Swiper.use([Navigation, Pagination, Autoplay]);

window.KchipsLib = { $, Swiper, gsap, flatpickr }