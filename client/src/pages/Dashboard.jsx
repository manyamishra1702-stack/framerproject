import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { AlertTriangle, Bug, CloudRain, TrendingUp, Scan, UploadCloud, MapPin, Camera, X, Settings } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' ? 'http://localhost:8000' : 'https://agrix-1coj.onrender.com');

const weatherCodeLabels = {
  0: 'Clear Sky',
  1: 'Mainly Clear',
  2: 'Partly Cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Rime Fog',
  51: 'Light Drizzle',
  53: 'Drizzle',
  55: 'Heavy Drizzle',
  61: 'Light Rain',
  63: 'Rain',
  65: 'Heavy Rain',
  71: 'Light Snow',
  73: 'Snow',
  75: 'Heavy Snow',
  80: 'Rain Showers',
  81: 'Heavy Showers',
  82: 'Violent Showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm With Hail',
  99: 'Severe Thunderstorm',
};

function getWeatherLabel(code) {
  return weatherCodeLabels[code] || 'Forecast Updated';
}

function buildIrrigationAdvice(forecast, t) {
  const rainChance = forecast.daily?.precipitation_probability_max?.[0] ?? 0;
  const weatherCode = forecast.current?.weather_code;
  const rainyNow = [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(weatherCode);

  if (rainyNow || rainChance >= 60) {
    return t('dashboard.irrigation_advice_delay', 'Delay watering for 24-48 hours. Rain is likely in this forecast window.');
  }

  if (rainChance >= 30) {
    return t('dashboard.irrigation_advice_light', 'Use light irrigation and check soil moisture before watering deeply.');
  }

  return t('dashboard.irrigation_advice_normal', 'Water on the next cool morning or evening if the top soil feels dry.');
}

function buildPestAlert(forecast, t) {
  if (!forecast?.current) {
    return {
      level: 'waiting',
      label: t('dashboard.pest_waiting_level', 'Waiting'),
      title: t('dashboard.pest_waiting_title', 'Weather Data Needed'),
      message: t('dashboard.pest_waiting_message', 'Share your location to estimate pest pressure for this week.'),
      action: t('dashboard.pest_waiting_action', 'Enable weather access for field-specific alerts.'),
      pests: [],
    };
  }

  const temp = forecast.current.temperature_2m;
  const humidity = forecast.current.relative_humidity_2m;
  const rainChance = forecast.daily?.precipitation_probability_max?.[0] ?? 0;
  const rainyNow = [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(forecast.current.weather_code);
  const warmAndHumid = temp >= 20 && temp <= 32 && humidity >= 70;
  const hotAndDry = temp >= 30 && humidity <= 45;
  const mildAndMoist = temp >= 18 && temp <= 28 && (humidity >= 65 || rainChance >= 45 || rainyNow);

  if (warmAndHumid && rainChance >= 35) {
    return {
      level: 'high',
      label: t('dashboard.pest_high_level', 'High Risk'),
      title: t('dashboard.pest_high_title', 'High Risk Of Aphids This Week'),
      message: t('dashboard.pest_high_message', 'Warm, humid weather can speed up aphid and whitefly outbreaks, especially on tender new growth.'),
      action: t('dashboard.pest_high_action', 'Inspect leaf undersides every 2-3 days and isolate heavily affected patches early.'),
      pests: ['Aphids', 'Whiteflies'],
    };
  }

  if (hotAndDry) {
    return {
      level: 'medium',
      label: t('dashboard.pest_mite_level', 'Medium Risk'),
      title: t('dashboard.pest_mite_title', 'Watch For Mites'),
      message: t('dashboard.pest_mite_message', 'Hot, dry conditions favor mite pressure and leaf speckling on stressed plants.'),
      action: t('dashboard.pest_mite_action', 'Check dusty field edges first and avoid water stress where possible.'),
      pests: ['Mites'],
    };
  }

  if (mildAndMoist) {
    return {
      level: 'medium',
      label: t('dashboard.pest_medium_level', 'Medium Risk'),
      title: t('dashboard.pest_medium_title', 'Moisture Pest Watch'),
      message: t('dashboard.pest_medium_message', 'Moist conditions can increase caterpillar, thrips, and fungal-linked pest activity.'),
      action: t('dashboard.pest_medium_action', 'Scout dense crop areas and improve airflow where plants are crowded.'),
      pests: ['Thrips', 'Caterpillars'],
    };
  }

  return {
    level: 'low',
    label: t('dashboard.pest_low_level', 'Low Risk'),
    title: t('dashboard.pest_low_title', 'Low Pest Pressure'),
    message: t('dashboard.pest_low_message', 'Current temperature and humidity do not point to a major pest spike this week.'),
    action: t('dashboard.pest_low_action', 'Keep routine scouting active and recheck after rain or sudden humidity changes.'),
    pests: ['Routine Scout'],
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login', { replace: true });
  };

  const [userProfile, setUserProfile] = useState(null);
  const [farmDescMissing, setFarmDescMissing] = useState(false);
  const [bannerInputText, setBannerInputText] = useState('');
  const [bannerStatus, setBannerStatus] = useState('idle'); // idle, submitting
  
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };
  
  const fetchUser = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/user/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUserProfile(data);
        if (!data.farm_description) {
          setFarmDescMissing(true);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const submitTextDescription = async () => {
    if (!bannerInputText.trim()) return;
    setBannerStatus('submitting');
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE_URL}/api/user/farm-description/text`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ description: bannerInputText, language: i18n.language })
      });
      if (response.ok) {
        setFarmDescMissing(false);
        showToast(t('settings.toast_pref_success', 'Preferences saved successfully!'), 'success');
        await fetchUser();
      } else {
        const errorData = await response.json().catch(() => null);
        const errorMsg = errorData?.detail || t('settings.toast_pref_error', 'Error saving preferences.');
        showToast(`Error: ${errorMsg}`, 'error');
      }
    } catch (e) {
      console.error(e);
      showToast(e.message || t('settings.toast_pref_error', 'Error saving preferences.'), 'error');
    }
    setBannerStatus('idle');
  };

  const marketData = userProfile?.marketData;
  const marketDataArray = Array.isArray(marketData) ? marketData : (marketData ? [marketData] : []);
  const marketStatus = marketDataArray.length > 0 ? 'success' : 'idle';
  const [isRefreshingPrices, setIsRefreshingPrices] = useState(false);

  const handleRefreshPrices = async () => {
    setIsRefreshingPrices(true);
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${API_BASE_URL}/api/user/refresh-market-data`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ language: i18n.language })
      });
      if (response.ok) {
        showToast(t('dashboard.toast_prices_refreshed', 'Prices refreshed successfully!'), 'success');
        await fetchUser();
      } else {
        const errorData = await response.json().catch(() => null);
        showToast(`Error: ${errorData?.detail || 'Failed to refresh prices'}`, 'error');
      }
    } catch (e) {
      console.error(e);
      showToast(e.message || 'Error refreshing prices', 'error');
    }
    setIsRefreshingPrices(false);
  };

  const handleViewReport = () => {
    navigate('/report');
  };

  const fileInputRef = useRef(null);
  const cropPreviewRef = useRef('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cropFile, setCropFile] = useState(null);
  const [cropPreview, setCropPreview] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [scanStatus, setScanStatus] = useState('idle');
  const [scanError, setScanError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [locationLabel, setLocationLabel] = useState('Requesting location...');
  const [weather, setWeather] = useState(null);
  const [weatherStatus, setWeatherStatus] = useState('loading');
  const [weatherError, setWeatherError] = useState('');

  useEffect(() => {
    if (!navigator.geolocation) {
      window.setTimeout(() => {
        setWeatherStatus('error');
        setWeatherError('Location access is not supported by this browser.');
        setLocationLabel('Location unavailable');
      }, 0);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          setWeatherStatus('loading');
          const { latitude, longitude } = coords;

          const langCode = i18n.language ? i18n.language.split('-')[0] : 'en';
          const [forecastResponse, placeResponse] = await Promise.all([
            fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=celsius&timezone=auto&forecast_days=3`
            ),
            fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=${langCode}`
            ),
          ]);

          if (!forecastResponse.ok) {
            throw new Error('Weather forecast could not be loaded.');
          }

          const forecast = await forecastResponse.json();
          const place = placeResponse.ok ? await placeResponse.json() : null;
          const locality = place?.city || place?.locality || place?.principalSubdivision;
          const region = place?.principalSubdivisionCode || place?.principalSubdivision;

          setWeather(forecast);
          setLocationLabel(
            [locality, region].filter(Boolean).join(', ') ||
              `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`
          );
          setWeatherStatus('ready');
          setWeatherError('');
        } catch (error) {
          setWeatherStatus('error');
          setWeatherError(error.message || 'Weather forecast could not be loaded.');
          setLocationLabel('Location detected');
        }
      },
      (error) => {
        setWeatherStatus('error');
        setWeatherError(
          error.code === error.PERMISSION_DENIED
            ? 'Allow location access to show your local forecast.'
            : 'Unable to detect your location.'
        );
        setLocationLabel('Location needed');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }, [i18n.language]);

  useEffect(() => () => {
    if (cropPreviewRef.current) URL.revokeObjectURL(cropPreviewRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
  }, []);

  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play();
    }
  }, [cameraActive]);

  async function openCamera() {
    setScanError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      setCameraActive(true);
    } catch {
      setScanError('Camera access denied. Please allow camera permission in your browser.');
    }
  }

  function closeCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }

  function capturePhoto() {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
    canvas.toBlob((blob) => {
      const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
      handleCropFile(file);
      closeCamera();
    }, 'image/jpeg', 0.9);
  }

  const currentTemperature = useMemo(() => {
    const temp = weather?.current?.temperature_2m;
    return Number.isFinite(temp) ? Math.round(temp) : null;
  }, [weather]);

  const currentHumidity = useMemo(() => {
    const humidity = weather?.current?.relative_humidity_2m;
    return Number.isFinite(humidity) ? Math.round(humidity) : null;
  }, [weather]);

  const forecastLabel = weather ? t(`weather.${weather.current?.weather_code}`, getWeatherLabel(weather.current?.weather_code)) : t('dashboard.waiting_location', 'Waiting For Location');
  const irrigationAdvice = weather ? buildIrrigationAdvice(weather, t) : t('dashboard.irrigation_advice_waiting', 'Share your location to get local irrigation guidance.');
  const pestAlert = buildPestAlert(weather, t);
  const pestToneClasses = {
    high: 'bg-primary-red text-white',
    medium: 'bg-primary-yellow text-black',
    low: 'bg-green-400 text-black',
    waiting: 'bg-white text-black',
  };

  function handleCropFile(file) {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setScanError('Please upload an image file.');
      return;
    }

    if (cropPreviewRef.current) {
      URL.revokeObjectURL(cropPreviewRef.current);
    }

    const objectUrl = URL.createObjectURL(file);
    cropPreviewRef.current = objectUrl;
    setCropFile(file);
    setCropPreview(objectUrl);
    setScanResult(null);
    setScanError('');
    setScanStatus('idle');
  }

  function clearCropFile() {
    if (cropPreviewRef.current) {
      URL.revokeObjectURL(cropPreviewRef.current);
      cropPreviewRef.current = '';
    }

    setCropFile(null);
    setCropPreview('');
    setScanResult(null);
    setScanError('');
    setScanStatus('idle');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function compressImage(file, maxDimension = 1024, quality = 0.82) {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
      };
      img.src = url;
    });
  }

  async function analyzeCrop() {
    if (!cropFile) {
      setScanError('Choose or drop a crop image first.');
      return;
    }

    const compressed = await compressImage(cropFile);
    const formData = new FormData();
    formData.append('file', compressed, 'crop.jpg');

    try {
      setScanStatus('loading');
      setScanError('');
      const response = await fetch(`${API_BASE_URL}/api/farming/disease-detection`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Crop scan failed. Make sure the backend server is running.');
      }

      const result = await response.json();
      setScanResult(result);
      setScanStatus('success');
    } catch (error) {
      setScanStatus('error');
      setScanError(error.message || 'Crop scan failed.');
    }
  }

  return (
    <div className="dashboard-shell min-h-screen bg-background">
      {/* Top Navigation */}
      <nav className="border-b-4 border-black bg-white px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <BrandLogo tagline="Smart Farming" markClassName="w-11 h-11" />
        <div className="flex items-center gap-4">
           <Button variant="ghost" shape="pill" onClick={() => navigate('/settings')} className="flex gap-2">
             <Settings size={18} />
             <span className="hidden md:inline">{t('nav.settings', 'Settings')}</span>
           </Button>
           <Button variant="outline" onClick={handleLogout} className="py-2 px-4 text-sm">
             {t('nav.logout', 'Logout')}
           </Button>
        </div>
      </nav>

      {/* Bauhaus Toast */}
      {toast.show && (
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ease-in-out">
          <div className={`px-6 py-4 border-4 border-black font-bold uppercase tracking-widest text-lg shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ${toast.type === 'error' ? 'bg-primary-red text-white' : 'bg-green-400 text-black'}`}>
            {toast.message}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Farm Description Banner */}
        {farmDescMissing && (
          <div className="bg-primary-yellow border-4 border-black p-6 shadow-bauhaus-md relative">
            <h2 className="text-2xl font-black uppercase mb-2">{t('dashboard.banner_title', 'Tell Us About Your Farm')}</h2>
            <p className="font-bold mb-4">{t('dashboard.banner_desc', 'Please describe what you are farming and the size of your land so we can personalize your dashboard.')}</p>
            <div className="flex flex-col md:flex-row gap-4">
              <input 
                type="text" 
                value={bannerInputText}
                onChange={e => setBannerInputText(e.target.value)}
                placeholder={t('dashboard.banner_placeholder', "e.g., I farm 5 acres of wheat and rice...")} 
                className="flex-1 border-4 border-black p-3 font-bold"
                disabled={bannerStatus !== 'idle'}
              />
              <Button 
                onClick={submitTextDescription} 
                className="bg-black text-white"
                disabled={bannerStatus !== 'idle' || !bannerInputText.trim()}
              >
                {bannerStatus === 'submitting' ? t('dashboard.saving', 'Saving...') : t('dashboard.submit_text', 'Submit Text')}
              </Button>
            </div>
            {bannerStatus === 'submitting' && <p className="mt-2 font-bold animate-pulse">{t('dashboard.processing_ai', 'Processing with AI...')}</p>}
          </div>
        )}

        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-6 border-b-4 border-black">
          <div>
            <h1 className="text-6xl md:text-8xl" dangerouslySetInnerHTML={{ __html: t('dashboard.farm_overview', 'FARM<br/>OVERVIEW') }}></h1>
            <p className="text-xl font-bold uppercase tracking-widest mt-4">{t('dashboard.welcome', 'Welcome back, Developer')}</p>
          </div>
          <div className="bg-primary-yellow border-4 border-black shadow-bauhaus-md p-4 rotate-2">
             <p className="font-bold uppercase flex items-center gap-2">
               <MapPin size={18} />
               {t('dashboard.location', 'Location')}: {locationLabel}
             </p>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          
          {/* Disease Detection Card */}
          <Card decoration="circle" decorationColor="bg-primary-red" className="relative group">
            <div className="flex justify-between items-start mb-8">
              <h2 className="text-3xl md:text-4xl mb-4">{t('dashboard.crop_scan', 'CROP SCAN')}</h2>
              <div className="w-12 h-12 bg-primary-red border-4 border-black rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                <Scan className="text-white" />
              </div>
            </div>
            <p className="font-medium max-w-lg mb-8">{t('dashboard.scan_desc', 'Upload an image of your crop leaves to instantly detect diseases using our AI model.')}</p>
            <input
              ref={fileInputRef}
              className="hidden"
              type="file"
              accept="image/*"
              onChange={(event) => handleCropFile(event.target.files?.[0])}
            />
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                handleCropFile(event.dataTransfer.files?.[0]);
              }}
              className={`border-4 border-dashed border-black p-6 text-center mb-6 cursor-pointer transition-colors min-h-44 flex flex-col items-center justify-center gap-4 ${
                isDragging ? 'bg-primary-yellow' : 'bg-gray-50 hover:bg-gray-100'
              }`}
            >
               {cropPreview ? (
                 <>
                   <img src={cropPreview} alt="Selected crop preview" className="max-h-56 w-full object-contain border-4 border-black bg-white" />
                   <span className="font-bold uppercase tracking-widest break-all">{cropFile.name}</span>
                 </>
               ) : (
                 <>
                   <UploadCloud size={36} />
                   <span className="font-bold uppercase tracking-widest">{t('dashboard.drop_image', 'Drop Image Here Or Click To Upload')}</span>
                 </>
               )}
            </div>
            <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
              <Button variant="primary" onClick={analyzeCrop} disabled={scanStatus === 'loading'}>
                {scanStatus === 'loading' ? t('dashboard.analyzing', 'Analyzing...') : t('dashboard.analyze', 'Analyze Crop')}
              </Button>
              <Button variant="outline" onClick={openCamera} className="flex items-center gap-2">
                <Camera size={18} /> {t('dashboard.use_camera', 'Use Camera')}
              </Button>
              {cropFile && (
                <Button variant="outline" onClick={clearCropFile}>
                  {t('dashboard.remove_image', 'Remove Image')}
                </Button>
              )}
            </div>

            {cameraActive && (
              <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full max-w-lg border-4 border-white"
                />
                <div className="flex gap-4 mt-6">
                  <button
                    onClick={capturePhoto}
                    className="w-20 h-20 rounded-full bg-white border-4 border-black flex items-center justify-center hover:scale-105 transition-transform"
                  >
                    <Camera size={36} className="text-black" />
                  </button>
                  <button
                    onClick={closeCamera}
                    className="w-12 h-12 rounded-full bg-primary-red border-4 border-black flex items-center justify-center hover:scale-105 transition-transform self-end"
                  >
                    <X size={20} className="text-white" />
                  </button>
                </div>
                <p className="text-white font-bold uppercase tracking-widest mt-4">Click the circle to capture</p>
              </div>
            )}
            {scanError && <p className="mt-4 font-bold text-primary-red">{scanError}</p>}
            {scanResult && (
              <div className="mt-6 bg-white border-4 border-black p-4 shadow-bauhaus-md">
                <p className="font-bold uppercase tracking-widest text-gray-500 mb-1">Scan Result</p>
                <p className="text-3xl font-black uppercase">{scanResult.disease}</p>
                <p className="font-bold mt-2">Confidence: {scanResult.confidence}%</p>
                <p className="font-medium mt-2">{scanResult.recommendation}</p>
              </div>
            )}
          </Card>

          {/* Weather & Irrigation */}
          <Card decoration="square" decorationColor="bg-primary-blue" className="bg-primary-blue text-white group">
            <div className="flex justify-between items-start mb-8">
              <h2 className="text-3xl md:text-4xl text-white">{t('dashboard.weather', 'WEATHER')}</h2>
              <div className="w-12 h-12 bg-white border-4 border-black flex items-center justify-center group-hover:scale-110 transition-transform">
                <CloudRain className="text-primary-blue" />
              </div>
            </div>
            <div className="space-y-6">
              <div className="border-b-4 border-black pb-4">
                <p className="text-5xl font-black mb-2">
                  {currentTemperature === null ? '--' : currentTemperature}°C
                </p>
                <p className="font-bold uppercase">
                  {weatherStatus === 'loading' ? t('dashboard.loading_forecast', 'Loading Local Forecast') : forecastLabel}
                </p>
                {weatherError && <p className="font-medium mt-3 text-white">{weatherError}</p>}
              </div>
              <div>
                <p className="font-bold uppercase tracking-widest mb-2">{t('dashboard.irrigation_advice', 'Irrigation Advice')}</p>
                <div className="bg-white text-black p-4 border-4 border-black font-medium">
                  {irrigationAdvice}
                </div>
              </div>
              
              {weather?.daily?.time && (
                <div>
                  <p className="font-bold uppercase tracking-widest mb-2">{t('dashboard.forecast_3day', '3-Day Forecast')}</p>
                  <div className="flex gap-2">
                    {weather.daily.time.map((timeStr, index) => {
                      const date = new Date(timeStr);
                      const dayName = new Date(date.getTime() + date.getTimezoneOffset() * 60000).toLocaleDateString(i18n.language || 'en-US', { weekday: 'short' });
                      const maxT = Math.round(weather.daily.temperature_2m_max[index]);
                      const minT = Math.round(weather.daily.temperature_2m_min[index]);
                      const code = weather.daily.weather_code[index];
                      return (
                        <div key={timeStr} className="flex-1 bg-white text-black border-4 border-black p-2 text-center">
                          <p className="font-bold uppercase text-sm border-b-2 border-black pb-1 mb-1">{dayName}</p>
                          <div className="h-10 flex items-center justify-center">
                            <span className="text-xs font-bold leading-tight">{t(`weather.${code}`, getWeatherLabel(code))}</span>
                          </div>
                          <p className="font-black text-sm">{maxT}° <span className="text-gray-400 font-bold">{minT}°</span></p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Pest Alert System */}
          <Card decoration="circle" decorationColor="bg-primary-red" className="bg-white group">
            <div className="flex justify-between items-start mb-8">
              <div>
                <p className="font-black uppercase tracking-widest text-primary-red mb-2">{t('dashboard.ai_powered', 'AI Powered')}</p>
                <h2 className="text-3xl md:text-4xl">{t('dashboard.pest_alert', 'PEST ALERT')}</h2>
              </div>
              <div className="w-12 h-12 bg-primary-red border-4 border-black rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                <Bug className="text-white" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="border-4 border-black bg-primary-blue text-white p-3">
                <p className="text-xs font-black uppercase tracking-widest">{t('dashboard.temperature', 'Temp')}</p>
                <p className="text-2xl font-black">{currentTemperature === null ? '--' : currentTemperature}Â°C</p>
              </div>
              <div className="border-4 border-black bg-primary-yellow text-black p-3">
                <p className="text-xs font-black uppercase tracking-widest">{t('dashboard.humidity', 'Humidity')}</p>
                <p className="text-2xl font-black">{currentHumidity === null ? '--' : currentHumidity}%</p>
              </div>
            </div>

            <div className={`border-4 border-black p-4 shadow-bauhaus-md ${pestToneClasses[pestAlert.level]}`}>
              <div className="flex items-center justify-between gap-3 border-b-4 border-black/80 pb-3 mb-3">
                <p className="font-black uppercase tracking-widest">{pestAlert.label}</p>
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-2xl font-black uppercase leading-none mb-3">{pestAlert.title}</h3>
              <p className="font-bold leading-snug">{pestAlert.message}</p>
            </div>

            <div className="mt-6 border-4 border-black p-4 bg-gray-50">
              <p className="font-black uppercase tracking-widest text-sm mb-2">{t('dashboard.recommended_action', 'Recommended Action')}</p>
              <p className="font-medium">{pestAlert.action}</p>
            </div>

            {pestAlert.pests.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {pestAlert.pests.map((pest) => (
                  <span key={pest} className="border-4 border-black bg-white px-3 py-1 font-black uppercase text-xs shadow-bauhaus-sm">
                    {pest}
                  </span>
                ))}
              </div>
            )}
          </Card>

          {/* Price Predictions */}
          <Card decoration="triangle" decorationColor="bg-primary-yellow" className="bg-primary-yellow group lg:col-span-3">
             <div className="flex flex-col md:flex-row justify-between items-start gap-8">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-white border-4 border-black flex items-center justify-center" style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}>
                      <TrendingUp className="text-black" size={20} />
                    </div>
                    <h2 className="text-3xl md:text-4xl">{t('dashboard.market_price', 'MARKET PRICE')}</h2>
                  </div>
                  <p className="font-medium max-w-lg mb-6">{t('dashboard.market_desc', 'AI prediction based on current market trends and historical data.')}</p>
                  <Button variant="outline" onClick={handleViewReport}>{t('dashboard.view_report', 'View Full Report')}</Button>
                </div>
                <div className="flex-1 w-full flex flex-col gap-6">
                    {marketStatus === 'success' && marketDataArray.length > 0 ? (
                      <>
                        <div className="flex justify-end mb-[-1rem]">
                          <Button 
                            variant="primary" 
                            size="sm"
                            className="bg-black text-white hover:bg-gray-800 z-10"
                            onClick={handleRefreshPrices}
                            disabled={isRefreshingPrices}
                          >
                            {isRefreshingPrices ? t('dashboard.refreshing', 'Refreshing...') : t('dashboard.refresh_prices', 'Refresh Prices')}
                          </Button>
                        </div>
                        <div className="flex flex-col gap-6 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                          {marketDataArray.map((md, idx) => (
                            <div key={idx} className="bg-white border-4 border-black p-6 shadow-bauhaus-md flex flex-col justify-center min-h-[120px]">
                              <h3 className="text-xl font-black uppercase mb-4 pb-2 border-b-4 border-black inline-block">
                                {t('settings.' + md.crop.toLowerCase().replace(/ \/ .*/, '').replace(/ /g, '_'), md.crop)}
                              </h3>
                              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0">
                                <div className="text-center sm:text-left">
                                  <p className="font-bold uppercase tracking-widest text-gray-500 mb-1">{t('dashboard.current_price', 'Current Price')}</p>
                                  <p className="text-3xl md:text-4xl font-black">₹{md.current_price_per_quintal} / {t('dashboard.qtl', 'Qtl')}</p>
                                  {md.lastFetched && <p className="text-xs text-gray-500 mt-1 uppercase">{t('dashboard.last_fetched', 'Last Fetched')}: {new Date(md.lastFetched).toLocaleDateString()}</p>}
                                </div>
                                <div className="hidden sm:block w-1 bg-black self-stretch mx-4"></div>
                                <div className="text-center sm:text-left">
                                  <p className="font-bold uppercase tracking-widest text-gray-500 mb-1">{t('dashboard.next_month', 'Next Month (Est)')}</p>
                                  <p className="text-3xl md:text-4xl font-black text-primary-red">₹{md.predicted_price_next_month} / {t('dashboard.qtl', 'Qtl')}</p>
                                </div>
                                <div className="flex flex-col items-center gap-2 mt-4 sm:mt-0">
                                  <div className={`text-white px-4 py-2 uppercase font-bold transform rotate-3 ${md.advice === 'Hold' ? 'bg-black' : 'bg-primary-red'}`}>
                                     {md.advice === 'Hold' ? t('dashboard.hold', 'Hold') : t('dashboard.sell_now', 'Sell Now')}
                                  </div>
                                </div>
                              </div>
                              {md.graph_explanation && (
                                <div className="mt-6 pt-4 border-t-4 border-black">
                                  <h3 className="font-bold uppercase tracking-widest text-primary-red mb-2 text-sm">{t('dashboard.ai_analysis', 'AI Analysis')}</h3>
                                  <p className="font-medium text-sm leading-relaxed">{md.graph_explanation}</p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="bg-white border-4 border-black p-6 shadow-bauhaus-md flex flex-col justify-center min-h-[120px] text-center">
                        <p className="mb-4 font-bold uppercase">{t('dashboard.update_farm_desc_for_market', 'Update Farm Description to Generate Market Data')}</p>
                      </div>
                    )}
                 </div>
             </div>
          </Card>

        </div>
      </main>
    </div>
  );
}
