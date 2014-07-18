//
//  AppDelegate.m
//  WhereIsHe
//
//  Created by tomaszbrue on 14.08.13.
//  Copyright (c) 2013 InformMe. All rights reserved.
//

#import "AppDelegate.h"
#import "Reachability.h"
#import "ViewController.h"

@implementation AppDelegate

@synthesize lastUpdate, reachable, locationManager, socket, packetSize, timer;

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
    [UIApplication sharedApplication].idleTimerDisabled = YES;
    
    self.packetSize = 32;
    self.socket = [[GCDAsyncSocket alloc] initWithDelegate:self delegateQueue:dispatch_get_main_queue()];
    
    // Override point for customization after application launch.
    locationManager = [[CLLocationManager alloc] init];
    locationManager.desiredAccuracy = kCLLocationAccuracyBestForNavigation;
    locationManager.distanceFilter = 5;
    locationManager.delegate = self;
    locationManager.pausesLocationUpdatesAutomatically = YES;
    locationManager.activityType = CLActivityTypeFitness;
    
    [locationManager startUpdatingLocation];
    
    // Allocate a reachability object
    Reachability *reach = [Reachability reachabilityWithHostname:@"www.google.de"];
    
    // Set the blocks
    reach.reachableBlock = ^(Reachability*reach)
    {
        // flush url cache
        if (self.reachable == NO) {
            [self flushDataCache: nil];
        }
        
        self.reachable = YES;
    };
    
    reach.unreachableBlock = ^(Reachability*reach)
    {
        self.reachable = NO;
    };
    
    // Start the notifier, which will cause the reachability object to retain itself!
    [reach startNotifier];
    
    [self setTimer];
    
    return YES;
}

- (void)setTimer {
    self.timer = [NSTimer scheduledTimerWithTimeInterval: 30
                                                  target: self
                                                selector:@selector(flushDataCache:)
                                                userInfo: nil
                                                 repeats: YES];
}

- (void)applicationDidEnterBackground:(UIApplication *)application
{
    ViewController *viewContr = (ViewController *)self.window.rootViewController;
    [viewContr stopUpdating];
}

- (void)applicationWillEnterForeground:(UIApplication *)application
{
    ViewController *viewContr = (ViewController *)self.window.rootViewController;
    [viewContr startUpdating];
}

#pragma mark - Local Notification

- (void)application:(UIApplication *)application didReceiveLocalNotification:(UILocalNotification *)notification {
    NSLog(@"Notification fired");
}

#pragma mark - Location Services

- (void)locationManager:(CLLocationManager *)manager didUpdateToLocation:(CLLocation *)newLocation fromLocation:(CLLocation *)oldLocation
{
    if(newLocation.horizontalAccuracy <= 100 || location == nil)
    {
        location = newLocation;
        lastUpdate = [NSDate date];
        
        if (abs(newLocation.speed - oldLocation.speed) > 1 ||
            [newLocation distanceFromLocation:oldLocation] > locationManager.distanceFilter ||
            oldLocation == nil) {
            
            // only store if under 100m accurancy
            if ([UIApplication sharedApplication].applicationState == UIApplicationStateBackground)
            {
                [self sendBackgroundLocationToServer:newLocation];
            }
            else
            {
                [self sendLocationToServer:newLocation];
            }
        }
    }
}

- (void)locationManager:(CLLocationManager *)manager didFailWithError:(NSError *)error
{
	// Handle error
    if(error.code == kCLErrorDenied)
    {
        [locationManager stopUpdatingLocation];
    }
    else if(error.code == kCLErrorLocationUnknown)
    {
        // retry
        [locationManager startUpdatingLocation];
    }
}

- (void)locationManagerDidPauseLocationUpdates:(CLLocationManager *)manager {
    NSLog(@"locMan: locationManagerDidPauseLocationUpdates");
    
    [[UIApplication sharedApplication] cancelAllLocalNotifications];
    
    UILocalNotification *localNotification = [[UILocalNotification alloc] init];
    
    localNotification.fireDate = [[NSDate date] dateByAddingTimeInterval:5];
    localNotification.timeZone = [NSTimeZone defaultTimeZone];
    localNotification.alertBody = @"Stopped updating location!";
    localNotification.soundName = UILocalNotificationDefaultSoundName;
    localNotification.applicationIconBadgeNumber = 0; // increment
    
    [[UIApplication sharedApplication] scheduleLocalNotification:localNotification];
    
}

- (void)locationManagerDidResumeLocationUpdates:(CLLocationManager *)manager {
    [[UIApplication sharedApplication] cancelAllLocalNotifications];
    
    UILocalNotification *localNotification = [[UILocalNotification alloc] init];
    
    localNotification.fireDate = [[NSDate date] dateByAddingTimeInterval:5];
    localNotification.timeZone = [NSTimeZone defaultTimeZone];
    localNotification.alertBody = @"Resume updating location.";
    localNotification.soundName = UILocalNotificationDefaultSoundName;
    localNotification.applicationIconBadgeNumber = 0; // increment
    
    [[UIApplication sharedApplication] scheduleLocalNotification:localNotification];
}

- (void)sendBackgroundLocationToServer:(CLLocation *)loc
{
    // Note that the expiration handler block simply ends the task. It is important that we always
    // end tasks that we have started.
    bgTask = [[UIApplication sharedApplication] beginBackgroundTaskWithExpirationHandler:^{
        [[UIApplication sharedApplication] endBackgroundTask:bgTask];
    }];

    [self sendLocationToServer:loc];

    // AFTER ALL THE UPDATES close the task
    if (bgTask != UIBackgroundTaskInvalid)
    {
        [[UIApplication sharedApplication] endBackgroundTask:bgTask];
        bgTask = UIBackgroundTaskInvalid;
    }
}

- (void)sendLocationToServer:(CLLocation *)loc
{
    NSUserDefaults *prefs = [NSUserDefaults standardUserDefaults];
 
    if ([prefs boolForKey:@"service.state"] == YES || [prefs objectForKey:@"service.state"] == nil) {
        
        NSString *msgId = @"MCGP";
        NSData *msgIdData = [msgId dataUsingEncoding:NSASCIIStringEncoding];
        
        // id
        int32_t hwid = 100001;
        NSData *hwIdData = [NSData dataWithBytes:&hwid length:sizeof(int32_t)];
        
        // latitude
        float lat = (float)loc.coordinate.latitude;
        NSData *latitudeData = [NSData dataWithBytes:&lat length:sizeof(float)];
        
        // longitude
        float lon = (float)loc.coordinate.longitude;
        NSData *longitudeData = [NSData dataWithBytes:&lon length:sizeof(float)];
        
        // speed
        float spd = 0;
        if (loc.speed > 0) {
            spd = (float)(loc.speed * 1.94384449);
        }
        NSData *speedData = [NSData dataWithBytes:&spd length:sizeof(float)];
        
        // course
        uint16_t crs = (uint16_t)loc.course;
        NSData *courseData = [NSData dataWithBytes:&crs length:sizeof(uint16_t)];
        
        NSCalendar *calendar = [NSCalendar currentCalendar];
        [calendar setTimeZone:[NSTimeZone timeZoneForSecondsFromGMT:0]];
        NSDateComponents *components = [calendar components:(NSHourCalendarUnit | NSMinuteCalendarUnit | NSSecondCalendarUnit | NSMonthCalendarUnit | NSYearCalendarUnit | NSDayCalendarUnit) fromDate:loc.timestamp];
        
        // hdop
        uint16_t hdop = (uint16_t)loc.horizontalAccuracy;
        NSData *hdopData = [NSData dataWithBytes:&hdop length:sizeof(uint16_t)];
        
        // seconds
        uint8_t sec = (uint8_t)[components second];
        NSData *seconds = [NSData dataWithBytes:&sec length:sizeof(uint8_t)];
        
        // minutes
        uint8_t min = (uint8_t)[components minute];
        NSData *minutes = [NSData dataWithBytes:&min length:sizeof(uint8_t)];
        
        // hours
        uint8_t hrs = (uint8_t)[components hour];
        NSData *hours = [NSData dataWithBytes:&hrs length:sizeof(uint8_t)];
        
        // days
        uint8_t dys = (uint8_t)[components day];
        NSData *days = [NSData dataWithBytes:&dys length:sizeof(uint8_t)];
        
        // months
        uint8_t mnth = (uint8_t)[components month];
        NSData *months = [NSData dataWithBytes:&mnth length:sizeof(uint8_t)];
        
        // years
        uint16_t yrs = (uint16_t)[components year];
        NSData *years = [NSData dataWithBytes:&yrs length:sizeof(uint16_t)];
        
        uint8_t stts = 0;
        NSData *status = [NSData dataWithBytes:&stts length:sizeof(uint8_t)];
        
        // create data array
        NSMutableData *data = [[NSMutableData alloc] init];
        
        [data appendData:msgIdData];
        [data appendData:hwIdData];
        [data appendData:latitudeData];
        [data appendData:longitudeData];
        [data appendData:speedData];
        [data appendData:courseData];
        [data appendData:hdopData];
        [data appendData:seconds];
        [data appendData:minutes];
        [data appendData:hours];
        [data appendData:days];
        [data appendData:months];
        [data appendData:years];
        [data appendData:status];
        
        NSArray *urlCache = [prefs arrayForKey:@"data.cache"];
        
        // add
        NSMutableArray *addToCache = [[NSMutableArray alloc] initWithArray:urlCache];
        [addToCache addObject:data];
        [prefs setObject:[NSArray arrayWithArray:addToCache] forKey:@"data.cache"];
        
        if ((int)floor(1000 / self.packetSize) == [addToCache count]) {
            
            [self.timer invalidate];
            
            // flush to tcp server
            [self call:addToCache];
            [self setTimer];
        }
    }
}

- (void)flushDataCache:(NSTimer *)theTimer
{
    [self call:[[NSUserDefaults standardUserDefaults] arrayForKey:@"data.cache"]];
}

- (CLLocation *)getLastLocation
{
    return location;
}

- (void)call:(NSArray *)urlCache
{
    if (self.reachable == NO || [urlCache count] == 0) {
        return;
    }
    
    NSError *err = nil;
    
    if (![socket connectToHost:@"tracktrack.io" onPort:8100 error:&err]) // Asynchronous!
    {
        // If there was an error, it's likely something like "already connected" or "no delegate set"
        NSLog(@"I goofed: %@", err);
    }
    
    for(int i = 0; i < [urlCache count]; i++)
    {
        [socket writeData:(NSData *)[urlCache objectAtIndex:i] withTimeout:-1 tag:8100];
    }
    
    [socket disconnectAfterWriting];
    
    NSUserDefaults *prefs = [NSUserDefaults standardUserDefaults];
    int bytesSent = (int)[prefs integerForKey:@"bytes.sent"];
    bytesSent += self.packetSize * [urlCache count];
    [prefs setObject:[NSNumber numberWithInt:bytesSent] forKey:@"bytes.sent"];
    
    // flush cache
    [prefs setObject:[NSArray arrayWithArray:[NSMutableArray array]] forKey:@"data.cache"];
    
    ViewController *viewContr = (ViewController *)self.window.rootViewController;
    [viewContr.bytesSent setText:[NSString stringWithFormat:@"%i", bytesSent]];
}

@end
