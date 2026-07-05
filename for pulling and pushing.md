cd /home/artic/Vehicle_Monitoring_system
git pull origin master

# Rebuild and restart backend (topic fix + offline detection job)
cd backend
npm run build
pm2 restart vms-backend --update-env

# Rebuild and restart frontend (vehicle detail page + GPS ping button)
cd ../frontend
npm run build
pm2 restart vms-frontend

# Check both are running cleanly
pm2 logs --lines 20




git push origin master