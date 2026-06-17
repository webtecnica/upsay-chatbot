const bcrypt = require('bcryptjs');
bcrypt.hash('upsay2024', 10).then(h => console.log(h));
