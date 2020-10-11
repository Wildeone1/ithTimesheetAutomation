require('dotenv').config()
const express = require('express');
const Excel = require('exceljs');
const axios = require('axios');
const moment = require('moment');
const yargs = require('yargs');

const app = express();

const firstSunday = '06-09-2020';

const descriptionColumns = {
  Location: 'A',
  StartTime_1: 'D',
  EndTime_1: 'E',
  StartTime_2: 'F',
  EndTime_2: 'G',
}

const dayRow = {
  Monday: 9,
  Tuesday: 10,
  Wednesday: 11,
  Thursday: 12,
  Friday: 13,
  Saturday: 14,
  Sunday: 15,
}

const buildingsList = {
  gc1: 'GUILDHALL',
  gc2: 'GUILDHALL',
  gc3: 'GUILDHALL',
  gc4: 'GUILDHALL',
  gc5: 'GUILDHALL',
  ul1: 'LIBRARY',
  ul2: 'LIBRARY',
  pk: 'PARK',
  rb: 'RICHMOND',
  po: 'PORTLAND',
  hc: 'IT HELP CENTRE'
}

const getSpecificDayShifts = (shifts, day) => {
  const selectedDayShifts = shifts.filter((currentShift) => {
    return currentShift.day === day;
  })
  return selectedDayShifts;
}

const combineShifts = (shifts) => {
  
  if (shifts.length === 1) return shifts;

  const combinedShifts = [];
  for(let i = 0; i < shifts.length; i++) {

    if (i !== (shifts.length - 1) && shifts[i].building === shifts[i+1].building && shifts[i].end_time === shifts[i+1].start_time) {
      combinedShifts.push({
        start_time: shifts[i].start_time,
        end_time: shifts[i+1].end_time,
        day: shifts[i].day,
        building: shifts[i].building,
        week_id: shifts[i].week_id,
        week_number: shifts[i].week_number
      })
      i++; // return i++; then remove else
    } else combinedShifts.push(shifts[i])
  }

  return combinedShifts;
}

const calculateTotHoursWorkedPerDay = (shifts) => {
  let totalHours = 0;

  shifts.map((currentShift) => {
    const { start_time, end_time } = currentShift;
    const startTime = moment(start_time, "HH:mm:ss");
    const endTime = moment(end_time, "HH:mm:ss");
    const duration = moment.duration(endTime.diff(startTime));
    const hours = parseInt(duration.asHours());
    const minutes = parseInt(duration.asMinutes())%60;
    const decimalMinutes = minutes/60;

    totalHours += hours + decimalMinutes;
  })

  return totalHours;
}


const populateTimesheet = (templateTimesheet, shifts, day) => {

  const currentDayShifts = getSpecificDayShifts(shifts, day);

  if (currentDayShifts.length === 0) return;

  const LocationCell = templateTimesheet.getCell(`A${dayRow[day]}`);
  const TimeStartCell_1 = templateTimesheet.getCell(`D${dayRow[day]}`);
  const TimeEndCell_1 = templateTimesheet.getCell(`E${dayRow[day]}`);
  const TimeStartCell_2 = templateTimesheet.getCell(`F${dayRow[day]}`);
  const TimeEndCell_2 = templateTimesheet.getCell(`G${dayRow[day]}`);
  const TotalHoursCell_2 = templateTimesheet.getCell(`H${dayRow[day]}`);

  const combinedShifts = combineShifts(currentDayShifts); // if two separate shifts in a row in the same building, combine them
  const totHoursWorked = calculateTotHoursWorkedPerDay(combinedShifts);

  let locationString = buildingsList[combinedShifts[0].building];
  const ShiftTimeStart_1 = combinedShifts[0].start_time.slice(0, -3);
  const ShiftTimeEnd_1 = combinedShifts[0].end_time.slice(0, -3);
  
  TimeStartCell_1.value = ShiftTimeStart_1;
  TimeEndCell_1.value = ShiftTimeEnd_1;

  if (combinedShifts.length > 1) {
    locationString += ` - ${buildingsList[combinedShifts[1].building]}`;
    const ShiftTimeStart_2 = combinedShifts[1].start_time.slice(0, -3);
    const ShiftTimeEnd_2 = combinedShifts[1].end_time.slice(0, -3);

    TimeStartCell_2.value = ShiftTimeStart_2;
    TimeEndCell_2.value = ShiftTimeEnd_2;
  }

  LocationCell.value = locationString;
  TotalHoursCell_2.value = totHoursWorked;
  
  return;
}

const main = async () => {
  console.log(yargs.argv);
  const { weeknumber, cookie } = yargs.argv;
  
  let ENDPOINT = process.env.ITH_ENDPOINT;
  if (weeknumber) ENDPOINT += `?week=${weeknumber}`;

  const response = await axios.get(ENDPOINT, {
    headers: {
      Cookie: cookie
    }
  });
  const { week, shifts } = response.data;
  console.log(week, shifts);
  
  const workbook = new Excel.Workbook();
  
  const timesheetFile = await workbook.xlsx.readFile(process.env.TEMPLATE_PATH);
  const templateTimesheet = timesheetFile.getWorksheet(1);
  
  populateTimesheet(templateTimesheet, shifts, 'Monday');
  populateTimesheet(templateTimesheet, shifts, 'Tuesday');
  populateTimesheet(templateTimesheet, shifts, 'Wednesday');
  populateTimesheet(templateTimesheet, shifts, 'Thursday');
  populateTimesheet(templateTimesheet, shifts, 'Friday');
  populateTimesheet(templateTimesheet, shifts, 'Saturday');
  populateTimesheet(templateTimesheet, shifts, 'Sunday');

  const WeekendingSundayCell = templateTimesheet.getCell('J5');
  const currentSundayDate = moment(firstSunday, "DD-MM-YYYY").add((week - 1), 'weeks').format('DD-MM-YYYY') ;

  WeekendingSundayCell.value = currentSundayDate;

  return workbook.xlsx.writeFile(`Lopes, Ezequiel Week ${week} - Timesheet.xlsx`);
}

main();